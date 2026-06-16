
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  



select
    1
from DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_daily_revenue

where not(total_revenue > 0)


  
  
      
    ) dbt_internal_test