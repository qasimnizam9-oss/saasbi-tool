import pandas as pd
import numpy as np

class AIAnalyst:
    def clean_and_map(self, df):
        # 1. AUTO-CLEANING
        # Remove empty columns/rows
        df.dropna(how='all', axis=1, inplace=True)
        
        # Fill missing values based on data type
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].fillna("Unknown")
            else:
                df[col] = df[col].fillna(df[col].median() if not df[col].empty else 0)

        # 2. RELATIONSHIP & SCHEMA MAPPING
        schema = {
            "dimensions": [], # Categorical
            "measures": [],   # Numerical
            "relationships": []
        }

        for col in df.columns:
            if df[col].dtype in ['int64', 'float64']:
                schema["measures"].append(col)
            else:
                schema["dimensions"].append(col)
            
            # Identify ID columns as relationship points
            if 'id' in col.lower() or 'key' in col.lower():
                schema["relationships"].append(col)

        return df, schema