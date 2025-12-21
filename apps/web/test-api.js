import fetch from 'node-fetch';

async function testApi() {
  try {
    // Login to get a valid token
    const loginResponse = await fetch('http://localhost:9000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'SA001',
        password: 'Test@12345'
      })
    });

    if (!loginResponse.ok) {
      console.error('Login failed:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    console.log('Login successful');
    console.log('Token:', loginData.token);

    // Test the students endpoint
    const studentsResponse = await fetch('http://localhost:9000/superadmin/abacus/students', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });

    if (!studentsResponse.ok) {
      console.error('Students endpoint failed:', await studentsResponse.text());
      return;
    }

    const studentsData = await studentsResponse.json();
    console.log('Students data:', studentsData);
  } catch (error) {
    console.error('Error:', error);
  }
}

testApi();