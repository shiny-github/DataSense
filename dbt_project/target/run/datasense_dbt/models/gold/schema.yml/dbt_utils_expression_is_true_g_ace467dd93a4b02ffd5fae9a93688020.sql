
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  



select
    1
from DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_product_velocity

where not(units_sold > 0)


  
  
      
    ) dbt_internal_test