
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select sale_date
from DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_daily_revenue
where sale_date is null



  
  
      
    ) dbt_internal_test