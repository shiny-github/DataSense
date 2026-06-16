
  create or replace   view DATASENSE_DB.PUBLIC_PUBLIC_BRONZE.bronze_retail_raw
  
  
  
  
  as (
    SELECT
    InvoiceNo,
    StockCode,
    Description,
    Quantity,
    InvoiceDate,
    UnitPrice,
    CustomerID,
    Country,
    CURRENT_TIMESTAMP() AS _loaded_at
FROM DATASENSE_DB.RAW.ONLINE_RETAIL_II
  );

