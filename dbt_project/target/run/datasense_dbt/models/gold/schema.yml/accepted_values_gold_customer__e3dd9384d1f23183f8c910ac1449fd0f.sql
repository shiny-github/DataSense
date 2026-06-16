
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with all_values as (

    select
        customer_segment as value_field,
        count(*) as n_records

    from DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_customer_metrics
    group by customer_segment

)

select *
from all_values
where value_field not in (
    'VIP','REGULAR','OCCASIONAL'
)



  
  
      
    ) dbt_internal_test