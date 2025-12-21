import psycopg2
import os

# Database connection parameters
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "beats_lms_v2"
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

try:
    # Connect to the database
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    
    cursor = conn.cursor()
    
    # Test courses query
    print("Testing courses query...")
    cursor.execute("""
        SELECT id, code, name 
        FROM "AbacusCourse" 
        ORDER BY id
    """)
    
    courses = cursor.fetchall()
    print(f"Found {len(courses)} courses:")
    for course in courses:
        print(f"  Course {course[0]}: {course[2]} ({course[1]})")
    
    # Test modules query
    print("\nTesting modules query...")
    cursor.execute("""
        SELECT id, "courseId", index, title 
        FROM "AbacusModule" 
        WHERE "courseId" = %s
        ORDER BY index
    """, (courses[0][0],))
    
    modules = cursor.fetchall()
    print(f"Found {len(modules)} modules for course {courses[0][1]}:")
    for module in modules:
        print(f"  Module {module[0]}: {module[3]} (index: {module[2]})")
    
    # Test level counts per module
    print("\nTesting level counts per module...")
    for module in modules:
        cursor.execute("""
            SELECT COUNT(*) 
            FROM "AbacusLevel" 
            WHERE "moduleId" = %s
        """, (module[0],))
        
        level_count = cursor.fetchone()[0]
        print(f"  Module {module[0]} ({module[3]}) has {level_count} levels")
    
    # Test levels for first module
    if modules:
        print(f"\nTesting levels for module {modules[0][0]}...")
        cursor.execute("""
            SELECT id, "moduleId", "order", name, difficulty
            FROM "AbacusLevel" 
            WHERE "moduleId" = %s
            ORDER BY "order"
        """, (modules[0][0],))
        
        levels = cursor.fetchall()
        print(f"Found {len(levels)} levels:")
        for level in levels:
            print(f"  Level {level[0]}: {level[3]} (order: {level[2]}, difficulty: {level[4]})")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")