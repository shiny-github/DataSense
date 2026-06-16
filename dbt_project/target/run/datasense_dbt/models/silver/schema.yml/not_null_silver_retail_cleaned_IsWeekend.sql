
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select IsWeekend
from DATASENSE_DB.PUBLIC_PUBLIC_SILVER.silver_retail_cleaned
where IsWeekend is null



  
  
      
    ) dbt_internal_test