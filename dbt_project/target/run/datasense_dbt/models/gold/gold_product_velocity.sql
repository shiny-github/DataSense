
  
    

create or replace transient table DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_product_velocity
    
    
    
    as (WITH daily_product AS (
    -- One row per StockCode per day; MAX(Description) handles rare StockCode/description mismatches
    SELECT
        DATE(InvoiceDate)        AS sale_date,
        StockCode,
        MAX(Description)         AS Description,
        SUM(Quantity)            AS units_sold,
        SUM(TotalRevenue)        AS daily_revenue
    FROM DATASENSE_DB.PUBLIC_PUBLIC_SILVER.silver_retail_cleaned
    GROUP BY 1, 2
),

product_totals AS (
    -- Lifetime revenue per product, used to assign a stable cross-day revenue rank
    SELECT
        StockCode,
        SUM(daily_revenue) AS total_product_revenue
    FROM daily_product
    GROUP BY StockCode
),

with_rank AS (
    SELECT
        d.*,
        DENSE_RANK() OVER (ORDER BY t.total_product_revenue DESC) AS revenue_rank
    FROM daily_product d
    JOIN product_totals t USING (StockCode)
),

with_velocity AS (
    SELECT
        *,
        -- 7-day rolling average of units sold per product
        AVG(units_sold) OVER (
            PARTITION BY StockCode
            ORDER BY sale_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        )                                                                      AS units_7day_rolling_avg,
        -- decile rank within each day; decile 1 = top 10% by units sold
        NTILE(10) OVER (PARTITION BY sale_date ORDER BY units_sold DESC)       AS _day_decile
    FROM with_rank
)

SELECT
    sale_date,
    StockCode,
    Description,
    units_sold,
    daily_revenue,
    units_7day_rolling_avg,
    revenue_rank,
    CASE WHEN _day_decile = 1 THEN TRUE ELSE FALSE END                         AS is_fast_mover
FROM with_velocity
    )
;


  