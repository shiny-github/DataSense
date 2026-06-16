
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select is_guest_purchase
from DATASENSE_DB.PUBLIC_PUBLIC_SILVER.silver_retail_cleaned
where is_guest_purchase is null



  
  
      
    ) dbt_internal_test