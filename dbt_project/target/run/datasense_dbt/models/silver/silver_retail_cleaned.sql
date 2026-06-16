
  
    

create or replace transient table DATASENSE_DB.PUBLIC_PUBLIC_SILVER.silver_retail_cleaned
    
    
    
    as (WITH base AS (
    -- Step A: drop rows where critical fields are null
    SELECT *
    FROM DATASENSE_DB.PUBLIC_PUBLIC_BRONZE.bronze_retail_raw
    WHERE InvoiceDate IS NOT NULL
      AND StockCode   IS NOT NULL
      AND Quantity    IS NOT NULL
),

with_medians AS (
    -- Step B (price): compute median UnitPrice per StockCode via window function
    SELECT
        *,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY UnitPrice)
            OVER (PARTITION BY TRIM(StockCode)) AS _median_unit_price
    FROM base
),

filled AS (
    -- Step B: fill remaining missing values; exclude rows where price is still null
    SELECT
        InvoiceNo,
        TRIM(StockCode)                                                     AS StockCode,
        TRIM(COALESCE(Description, 'UNKNOWN'))                              AS Description,
        Quantity,
        InvoiceDate,
        COALESCE(UnitPrice, _median_unit_price)                             AS UnitPrice,
        CASE WHEN CustomerID IS NULL THEN 'GUEST'
             ELSE CustomerID::VARCHAR END                                    AS CustomerID,
        CASE WHEN CustomerID IS NULL THEN TRUE ELSE FALSE END               AS is_guest_purchase,
        INITCAP(COALESCE(Country, 'UNSPECIFIED'))                           AS Country,
        _loaded_at
    FROM with_medians
    WHERE COALESCE(UnitPrice, _median_unit_price) IS NOT NULL
),

cleaned AS (
    -- Step C: remove cancelled orders, bad quantities/prices, non-product codes
    SELECT *
    FROM filled
    WHERE InvoiceNo NOT LIKE 'C%'
      AND Quantity  > 0
      AND UnitPrice > 0
      AND StockCode NOT IN (
            'POST', 'DOT', 'BANK CHARGES', 'AMAZONFEE',
            'PADS', 'CRUK', 'M', 'S', 'DCGSSBOY', 'DCGSSGIRL'
          )
),

transformed AS (
    -- Step D: parse timestamps, derive calendar columns, compute TotalRevenue
    SELECT
        InvoiceNo,
        StockCode,
        Description,
        Quantity,
        TRY_TO_TIMESTAMP_NTZ(InvoiceDate::VARCHAR)                          AS InvoiceDate,
        UnitPrice,
        CustomerID,
        is_guest_purchase,
        Country,
        Quantity * UnitPrice                                                 AS TotalRevenue,
        MONTH(TRY_TO_TIMESTAMP_NTZ(InvoiceDate::VARCHAR))                   AS InvoiceMonth,
        YEAR(TRY_TO_TIMESTAMP_NTZ(InvoiceDate::VARCHAR))                    AS InvoiceYear,
        CASE DAYOFWEEK(TRY_TO_TIMESTAMP_NTZ(InvoiceDate::VARCHAR))
            WHEN 0 THEN 'Sunday'
            WHEN 1 THEN 'Monday'
            WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
        END                                                                  AS DayOfWeek,
        CASE
            WHEN DAYOFWEEK(TRY_TO_TIMESTAMP_NTZ(InvoiceDate::VARCHAR)) IN (0, 6)
            THEN TRUE ELSE FALSE
        END                                                                  AS IsWeekend,
        _loaded_at
    FROM cleaned
),

percentiles AS (
    -- Step E: compute dataset-wide 99th percentile thresholds
    SELECT
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY UnitPrice) AS price_p99,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY Quantity)  AS qty_p99
    FROM transformed
),

flagged AS (
    -- Step E: attach outlier flags without removing any rows
    SELECT
        t.*,
        NULLIF(
            ARRAY_TO_STRING(
                ARRAY_CONSTRUCT_COMPACT(
                    IFF(t.UnitPrice    > p.price_p99, 'price_outlier',           NULL),
                    IFF(t.Quantity     > p.qty_p99,   'bulk_order',              NULL),
                    IFF(t.TotalRevenue > 10000,       'high_value_transaction',  NULL)
                ),
                ','
            ),
            ''
        )                                                                    AS data_quality_flag,
        CASE
            WHEN t.UnitPrice    > p.price_p99
              OR t.Quantity     > p.qty_p99
              OR t.TotalRevenue > 10000
            THEN TRUE ELSE FALSE
        END                                                                  AS is_flagged
    FROM transformed t
    CROSS JOIN percentiles p
)

SELECT * FROM flagged
    )
;


  