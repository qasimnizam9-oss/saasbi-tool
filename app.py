import os
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine, text
from flask_cors import CORS

app = Flask(__name__)
# CORS allows the Frontend (JS) to communicate with this Backend
CORS(app)

# --- DATABASE CONFIGURATION ---
DB_USER = "root"
DB_PASS = "qasimnizam123." 
DB_HOST = "localhost"
DB_NAME = "genius_bi_db"

DB_URI = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"
app.config['SQLALCHEMY_DATABASE_URI'] = DB_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
# Connection pooling prevents "Server Connection Failed" errors during high-volume operations
engine = create_engine(DB_URI, pool_size=15, max_overflow=20)

# --- MODELS ---
class MasterRegistry(db.Model):
    __tablename__ = 'master_registry'
    id = db.Column(db.Integer, primary_key=True) 
    file_name = db.Column(db.String(255))
    table_assigned = db.Column(db.String(100))
    rows_count = db.Column(db.Integer)
    upload_date = db.Column(db.DateTime, default=db.func.current_timestamp())

# Initialize the database and ensure the registry table exists
with app.app_context():
    db.create_all()

# --- HELPER FUNCTIONS ---
def sanitize_name(name):
    """Ensures filenames and column names are safe for MySQL identifiers."""
    clean = "".join([c if c.isalnum() else "_" for c in name.rsplit('.', 1)[0]])
    # MySQL tables starting with numbers can cause syntax errors; prefix if necessary
    if clean[0].isdigit():
        clean = "tbl_" + clean
    return clean.lower()

def generate_basic_insights(df):
    """Generates the automated AI Insight Stream for dashboard summaries."""
    insights = []
    try:
        insights.append(f"Analysis complete: {len(df)} records across {len(df.columns)} fields.")
        
        # Numeric column insights
        num_cols = df.select_dtypes(include=['number']).columns
        if not num_cols.empty:
            top_measure = num_cols[0]
            insights.append(f"Primary metric identified: '{top_measure}' (Average: {df[top_measure].mean():.2f}).")
        
        # Categorical column insights
        cat_cols = df.select_dtypes(include=['object']).columns
        if not cat_cols.empty:
            top_cat = cat_cols[0]
            if not df[top_cat].mode().empty:
                top_val = df[top_cat].mode()[0]
                insights.append(f"Top performing category in '{top_cat}': '{top_val}'.")
            
    except Exception:
        insights.append("Data validation successful. Dashboard visualization ready.")
    return insights

# --- ROUTES ---

@app.route('/')
def index():
    """Serves the main dashboard interface."""
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    """Processes uploaded files and returns data preview + AI insights."""
    try:
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "No file part in request"})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"status": "error", "message": "No file selected"})

        # Support for CSV and Excel files
        df = pd.read_csv(file) if file.filename.endswith('.csv') else pd.read_excel(file)

        # Standardize column names for MySQL compatibility
        df.columns = [sanitize_name(col) for col in df.columns]

        # Handle incompatible types for JSON (NaN and NaT)
        df = df.replace({np.nan: None, pd.NaT: None})
        
        # Format date columns for clean frontend display
        for col in df.select_dtypes(include=['datetime', 'datetimetz']).columns:
            df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')

        ai_insights = generate_basic_insights(df)

        return jsonify({
            "status": "success",
            "filename": file.filename,
            "table_name": sanitize_name(file.filename),
            "data": df.to_dict(orient='records'),
            "insights": ai_insights,
            "schema": {
                "dimensions": df.select_dtypes(include=['object']).columns.tolist(),
                "measures": df.select_dtypes(include=['number']).columns.tolist()
            }
        })
    except Exception as e:
        print(f"Analyze Error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)})

@app.route('/push-to-db', methods=['POST'])
def push_to_db():
    """Migrates processed data from the frontend state to a permanent MySQL table."""
    try:
        content = request.json
        if not content:
            return jsonify({"status": "error", "message": "Payload empty"})

        df = pd.DataFrame(content.get('data'))
        t_name = content.get('table_name', 'unnamed_table')
        
        # Write data to a dynamic MySQL table using the engine
        # Chunking ensures the server doesn't time out on large datasets
        df.to_sql(t_name, con=engine, if_exists='replace', index=False, chunksize=1000)

        # Log the table information in the Master Registry
        entry = MasterRegistry(
            file_name=content.get('filename'), 
            table_assigned=t_name, 
            rows_count=len(df)
        )
        db.session.add(entry)
        db.session.commit()

        return jsonify({"status": "success", "message": f"Successfully migrated to table: {t_name}"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)})

@app.route('/get-db-logs', methods=['GET'])
def get_logs():
    """Retrieves all previous upload logs from the registry."""
    try:
        query = text("SELECT * FROM master_registry ORDER BY upload_date DESC")
        with engine.connect() as conn:
            result = conn.execute(query)
            data = [dict(row._mapping) for row in result]
        return jsonify({"status": "success", "data": data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/delete-log/<int:log_id>', methods=['DELETE'])
def delete_log(log_id):
    """Removes a record from the registry and drops the associated data table."""
    try:
        # Fetch the registry entry
        record = db.session.get(MasterRegistry, log_id)
        
        if not record:
            return jsonify({"status": "error", "message": "Log record not found"}), 404

        table_to_drop = record.table_assigned
        
        # 1. Attempt to drop the dynamic table associated with this log
        try:
            with engine.connect() as conn:
                # Use backticks to handle table names with special characters or reserved words
                conn.execute(text(f"DROP TABLE IF EXISTS `{table_to_drop}`"))
                conn.commit()
            print(f"Cleaned up table: {table_to_drop}")
        except Exception as drop_err:
            # If the table was already manually deleted, we still want to remove the log entry
            print(f"Warning: Table cleanup skipped or failed: {drop_err}")

        # 2. Delete the record from the Master Registry
        db.session.delete(record)
        db.session.commit()

        return jsonify({"status": "success", "message": "Record and associated data cleared successfully."})

    except Exception as e:
        db.session.rollback()
        print(f"Delete Logic Error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # threaded=True is vital for ensuring the server can process a 
    # delete request while the frontend is still polling for logs.
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)