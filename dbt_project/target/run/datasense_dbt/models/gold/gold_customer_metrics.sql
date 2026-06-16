
  
    

create or replace transient table DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_customer_metrics
    
    
    
    as (WITH customer_base AS (
    SELECT
        CustomerID,
        SUM(TotalRevenue)          AS total_spend,
        COUNT(DISTINCT InvoiceNo)  AS total_orders,
        MIN(InvoiceDate)           AS first_purchase_date,
        MAX(InvoiceDate)           AS last_purchase_date
    FROM DATASENSE_DB.PUBLIC_PUBLIC_SILVER.silver_retail_cleaned
    WHERE CustomerID != 'GUEST'
    GROUP BY CustomerID
)

SELECT
    CustomerID,
    total_spend,
    total_orders,
    total_spend / NULLIF(total_orders, 0)                                         AS avg_order_value,
    first_purchase_date,
    last_purchase_date,
    DATEDIFF('day', last_purchase_date, CURRENT_DATE())                           AS days_since_last_purchase,
    -- GREATEST(..., 1) prevents division-by-zero for single-month customers
    total_orders / GREATEST(DATEDIFF('month', first_purchase_date, last_purchase_date), 1)
                                                                                  AS orders_per_month,
    CASE
        WHEN total_spend >  1000 THEN 'VIP'
        WHEN total_spend >= 250  THEN 'REGULAR'
        ELSE                          'OCCASIONAL'
    END                                                                           AS customer_segment
FROM customer_base
    )
;


  