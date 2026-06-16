
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select TotalRevenue
from DATASENSE_DB.PUBLIC_PUBLIC_SILVER.silver_retail_cleaned
where TotalRevenue is null



  
  
      
    ) dbt_internal_test