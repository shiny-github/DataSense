WITH daily_agg AS (
    SELECT
        DATE(InvoiceDate)                                                              AS sale_date,
        Country,
        SUM(TotalRevenue)                                                              AS total_revenue,
        COUNT(DISTINCT InvoiceNo)                                                      AS total_orders,
        COUNT(DISTINCT CASE WHEN CustomerID != 'GUEST' THEN CustomerID END)            AS unique_customers
    FROM {{ ref('silver_retail_cleaned') }}
    GROUP BY 1, 2
),

with_window AS (
    SELECT
        *,
        -- 7-day rolling average partitioned per country
        AVG(total_revenue) OVER (
            PARTITION BY Country
            ORDER BY sale_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        )                                                                              AS revenue_7day_rolling_avg,
        -- previous day's revenue for DoD calculation
        LAG(total_revenue) OVER (PARTITION BY Country ORDER BY sale_date)              AS _prev_day_revenue,
        -- global mean and stddev for z-score (across all date-country rows)
        AVG(total_revenue)    OVER ()                                                  AS _global_avg,
        STDDEV(total_revenue) OVER ()                                                  AS _global_stddev
    FROM daily_agg
),

enriched AS (
    SELECT
        sale_date,
        Country,
        total_revenue,
        total_orders,
        unique_customers,
        total_revenue / NULLIF(total_orders, 0)                                        AS avg_order_value,
        revenue_7day_rolling_avg,
        (total_revenue - _prev_day_revenue)
            / NULLIF(_prev_day_revenue, 0) * 100                                       AS revenue_dod_change_pct,
        (total_revenue - _global_avg) / NULLIF(_global_stddev, 0)                     AS revenue_zscore
    FROM with_window
)

SELECT
    *,
    CASE WHEN ABS(revenue_zscore) > 2.5 THEN TRUE ELSE FALSE END                      AS is_anomaly_day
FROM enriched
