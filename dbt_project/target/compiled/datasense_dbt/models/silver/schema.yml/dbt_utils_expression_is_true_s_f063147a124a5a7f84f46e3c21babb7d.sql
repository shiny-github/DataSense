



select
    1
from DATASENSE_DB.PUBLIC_PUBLIC_SILVER.silver_retail_cleaned

where not(TotalRevenue > 0)

