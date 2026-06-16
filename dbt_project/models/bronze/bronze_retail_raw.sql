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
FROM {{ source('raw', 'ONLINE_RETAIL_II') }}
