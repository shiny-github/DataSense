
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select total_spend
from DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_customer_metrics
where total_spend is null



  
  
      
    ) dbt_internal_test