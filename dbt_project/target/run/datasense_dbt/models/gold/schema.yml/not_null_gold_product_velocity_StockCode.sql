
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select StockCode
from DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_product_velocity
where StockCode is null



  
  
      
    ) dbt_internal_test