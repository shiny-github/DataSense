
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with all_values as (

    select
        anomaly_type as value_field,
        count(*) as n_records

    from DATASENSE_DB.PUBLIC_PUBLIC_GOLD.gold_anomaly_features
    group by anomaly_type

)

select *
from all_values
where value_field not in (
    'revenue_spike','revenue_drop','normal'
)



  
  
      
    ) dbt_internal_test