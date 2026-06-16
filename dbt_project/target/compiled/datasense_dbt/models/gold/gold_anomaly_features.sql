WITH daily_totals AS (
    -- Roll up gold_daily_revenue from (date, country) → single date row
    SELECT
        sale_date,
        SUM(total_revenue)      AS total_revenue,
        SUM(total_orders)       AS total_orders,
        SUM(unique_customers)   AS unique_customers
    FROM DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_daily_revenue
    GROUP BY sale_date
),

with_windows AS (
    SELECT
        *,
        (total_revenue - AVG(total_revenue) OVER ())
            / NULLIF(STDDEV(total_revenue) OVER (), 0)                         AS revenue_zscore,
        (total_revenue - LAG(total_revenue) OVER (ORDER BY sale_date))
            / NULLIF(LAG(total_revenue) OVER (ORDER BY sale_date), 0) * 100    AS revenue_dod_change_pct,
        AVG(total_revenue) OVER (
            ORDER BY sale_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        )                                                                      AS revenue_7day_rolling_avg
    FROM daily_totals
),

with_flags AS (
    SELECT
        *,
        CASE WHEN ABS(revenue_zscore) > 2.5 THEN TRUE ELSE FALSE END          AS is_anomaly_day,
        CASE
            WHEN revenue_zscore >  2.5 THEN 'revenue_spike'
            WHEN revenue_zscore < -2.5 THEN 'revenue_drop'
            ELSE                            'normal'
        END                                                                    AS anomaly_type,
        CASE WHEN DAYOFWEEK(sale_date) IN (0, 6) THEN TRUE ELSE FALSE END      AS is_weekend
    FROM with_windows
),

top_products AS (
    -- Pick the highest-selling product per day using Snowflake QUALIFY
    SELECT
        sale_date,
        StockCode AS top_product_that_day
    FROM DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_product_velocity
    QUALIFY ROW_NUMBER() OVER (PARTITION BY sale_date ORDER BY units_sold DESC) = 1
)

SELECT
    f.sale_date,
    f.total_revenue,
    f.total_orders,
    f.unique_customers,
    f.revenue_zscore,
    f.revenue_dod_change_pct,
    f.revenue_7day_rolling_avg,
    f.is_anomaly_day,
    t.top_product_that_day,
    f.is_weekend,
    f.anomaly_type
FROM with_flags f
LEFT JOIN top_products t ON f.sale_date = t.sale_date