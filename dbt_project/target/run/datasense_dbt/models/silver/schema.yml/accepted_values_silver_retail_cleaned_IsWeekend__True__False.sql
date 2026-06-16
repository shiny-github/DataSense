
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with all_values as (

    select
        IsWeekend as value_field,
        count(*) as n_records

    from DATASENSE_DB.PUBLIC_PUBLIC_SILVER.silver_retail_cleaned
    group by IsWeekend

)

select *
from all_values
where value_field not in (
    'True','False'
)



  
  
      
    ) dbt_internal_test