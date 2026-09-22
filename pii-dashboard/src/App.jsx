import React, { useState, useEffect } from 'react';


export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [piiData, setPiiData] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
 
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUnmasked, setIsUnmasked] = useState(false);
  const [editingId, setEditingId] = useState(null);


  // Search filters
  const [filters, setFilters] = useState({
    id: '', order_id: '', order_name: '', ssn: '', driver_license: '', dob: '', phone_number: '', citizen_id: ''
  });


  // Form states for New and Edit
  const emptyForm = { order_id: '', order_name: '', ssn: '', driver_license: '', dob: '', phone_number: '', citizen_id: '' };
  const [newRecord, setNewRecord] = useState(emptyForm);
  const [editRecord, setEditRecord] = useState(emptyForm);


  // --- Auth Handlers ---
  const handleRegister = async (e) => {
    e.preventDefault();
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: e.target.username.value, password: e.target.password.value })
    });
    if (response.ok) {
      setSuccessMsg('Registration successful! You can now log in.');
      setError('');
      setIsRegistering(false);
      e.target.reset();
    } else {
      const data = await response.json();
      setError(data.error || 'Registration failed');
    }
  };


  const handleLogin = async (e) => {
    e.preventDefault();
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: e.target.username.value, password: e.target.password.value })
    });
    if (response.ok) {
      const data = await response.json();
      setToken(data.token);
      localStorage.setItem('token', data.token);
      setError('');
    } else {
      setError('Invalid login credentials');
    }
  };


  const handleLogout = () => {
    setToken(null);
    setPiiData([]);
    localStorage.removeItem('token');
  };


  // --- Data Fetching ---
  const fetchDashboard = () => {
    if (!token) return;
    fetch('/api/pii-dashboard', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setPiiData(data))
      .catch(err => setError(err.message));
  };


  useEffect(() => {
    fetchDashboard();
  }, [token]);


  // --- CRUD Operations ---
  const handleCreate = async () => {
    const response = await fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newRecord)
    });
    if (response.ok) {
      const created = await response.json();
      setPiiData([...piiData, created]);
      setNewRecord(emptyForm);
    }
  };


  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    const response = await fetch(`/api/deliveries/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      setPiiData(piiData.filter(item => item.id !== id));
    }
  };


  const handleUpdate = async () => {
    const response = await fetch(`/api/deliveries/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(editRecord)
    });
    if (response.ok) {
      const updated = await response.json();
      setPiiData(piiData.map(item => item.id === editingId ? updated : item));
      setEditingId(null);
    }
  };


  const startEditing = (record) => {
    setEditingId(record.id);
    setEditRecord({
      order_id: record.order_id || '', order_name: record.order_name || '', ssn: record.ssn || '',
      driver_license: record.driver_license || '', dob: record.dob ? record.dob.split('T')[0] : '',
      phone_number: record.phone_number || '', citizen_id: record.citizen_id || ''
    });
  };


  // --- Utility Functions ---
  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });


  const filteredData = piiData.filter((record) => {
    return Object.keys(filters).every((key) => {
      if (!filters[key]) return true;
      const recordValue = record[key] ? String(record[key]).toLowerCase() : '';
      return recordValue.includes(filters[key].toLowerCase());
    });
  });


  const formatSensitive = (value) => {
    if (!value) return 'N/A';
    if (isUnmasked) return value;
    const strVal = String(value);
    return strVal.length > 4 ? `***-***-${strVal.slice(-4)}` : '***';
  };


  const exportToCSV = () => {
    const headers = ['ID', 'Order ID', 'Order Name', 'SSN', 'Driver License', 'DOB', 'Phone Number', 'Citizen ID'];
    const csvRows = [headers.join(',')];
   
    filteredData.forEach(row => {
      const values = [
        row.id, row.order_id, row.order_name, row.ssn, row.driver_license,
        row.dob ? new Date(row.dob).toLocaleDateString() : '',
        row.phone_number, row.citizen_id
      ].map(val => `"${val || ''}"`); // Enclose in quotes to handle commas in data
      csvRows.push(values.join(','));
    });


    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deliveries_export.csv';
    a.click();
  };


  // --- Render ---
  if (!token) {
    return (
      <div className="login-container" style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
        <h2>{isRegistering ? 'Register New Account' : 'System Login'}</h2>
        {successMsg && <p style={{color: 'green'}}>{successMsg}</p>}
        {error && <p style={{color: 'red'}}>{error}</p>}
        {isRegistering ? (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" name="username" placeholder="Choose a Username" required />
            <input type="password" name="password" placeholder="Choose a Password" required />
            <button type="submit">Register</button>
            <button type="button" onClick={() => setIsRegistering(false)}>Back to Login</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" name="username" placeholder="Username" required />
            <input type="password" name="password" placeholder="Password" required />
            <button type="submit">Log In</button>
            <button type="button" onClick={() => setIsRegistering(true)}>Need an account? Register</button>
          </form>
        )}
      </div>
    );
  }


  return (
    <div className="dashboard-container" style={{ padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>PII Management Dashboard</h2>
        <div>
          <button onClick={exportToCSV} style={{ marginRight: '10px', background: '#28a745', color: 'white' }}>Export to CSV</button>
          <button onClick={() => setIsUnmasked(!isUnmasked)} style={{ marginRight: '10px', background: isUnmasked ? '#dc3545' : '#ffc107' }}>
            {isUnmasked ? 'Mask Data' : 'Unmask Data'}
          </button>
          <button onClick={handleLogout}>Log Out</button>
        </div>
      </header>
     
      {error ? <p style={{color: 'red'}}>{error}</p> : (
        <div style={{ overflowX: 'auto', marginTop: '20px' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }} border="1">
            <thead>
              <tr style={{ backgroundColor: '#f4f4f9' }}>
                <th>ID</th><th>Order ID</th><th>Order Name</th><th>SSN</th><th>Driver License</th>
                <th>DOB</th><th>Phone</th><th>Citizen ID</th><th>Actions</th>
              </tr>
              {/* Filter Row */}
              <tr>
                {Object.keys(filters).map((key) => (
                  <th key={`filter-${key}`}>
                    <input type="text" name={key} value={filters[key]} onChange={handleFilterChange} placeholder="Search..." style={{ width: '90%' }}/>
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {/* Add New Row */}
              <tr style={{ backgroundColor: '#e9ecef' }}>
                <td>New</td>
                <td><input type="text" value={newRecord.order_id} onChange={(e) => setNewRecord({...newRecord, order_id: e.target.value})} style={{width: '90%'}}/></td>
                <td><input type="text" value={newRecord.order_name} onChange={(e) => setNewRecord({...newRecord, order_name: e.target.value})} style={{width: '90%'}}/></td>
                <td><input type="text" value={newRecord.ssn} onChange={(e) => setNewRecord({...newRecord, ssn: e.target.value})} style={{width: '90%'}}/></td>
                <td><input type="text" value={newRecord.driver_license} onChange={(e) => setNewRecord({...newRecord, driver_license: e.target.value})} style={{width: '90%'}}/></td>
                <td><input type="date" value={newRecord.dob} onChange={(e) => setNewRecord({...newRecord, dob: e.target.value})} style={{width: '90%'}}/></td>
                <td><input type="text" value={newRecord.phone_number} onChange={(e) => setNewRecord({...newRecord, phone_number: e.target.value})} style={{width: '90%'}}/></td>
                <td><input type="text" value={newRecord.citizen_id} onChange={(e) => setNewRecord({...newRecord, citizen_id: e.target.value})} style={{width: '90%'}}/></td>
                <td><button onClick={handleCreate}>Add</button></td>
              </tr>
             
              {/* Data Rows */}
              {filteredData.map(record => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  {editingId === record.id ? (
                    <>
                      <td><input type="text" value={editRecord.order_id} onChange={(e) => setEditRecord({...editRecord, order_id: e.target.value})} style={{width:'90%'}}/></td>
                      <td><input type="text" value={editRecord.order_name} onChange={(e) => setEditRecord({...editRecord, order_name: e.target.value})} style={{width:'90%'}}/></td>
                      <td><input type="text" value={editRecord.ssn} onChange={(e) => setEditRecord({...editRecord, ssn: e.target.value})} style={{width:'90%'}}/></td>
                      <td><input type="text" value={editRecord.driver_license} onChange={(e) => setEditRecord({...editRecord, driver_license: e.target.value})} style={{width:'90%'}}/></td>
                      <td><input type="date" value={editRecord.dob} onChange={(e) => setEditRecord({...editRecord, dob: e.target.value})} style={{width:'90%'}}/></td>
                      <td><input type="text" value={editRecord.phone_number} onChange={(e) => setEditRecord({...editRecord, phone_number: e.target.value})} style={{width:'90%'}}/></td>
                      <td><input type="text" value={editRecord.citizen_id} onChange={(e) => setEditRecord({...editRecord, citizen_id: e.target.value})} style={{width:'90%'}}/></td>
                      <td>
                        <button onClick={handleUpdate}>Save</button>
                        <button onClick={() => setEditingId(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{record.order_id}</td>
                      <td>{record.order_name}</td>
                      <td>{formatSensitive(record.ssn)}</td>
                      <td>{formatSensitive(record.driver_license)}</td>
                      <td>{record.dob ? new Date(record.dob).toLocaleDateString() : 'N/A'}</td>
                      <td>{record.phone_number || 'N/A'}</td>
                      <td>{formatSensitive(record.citizen_id)}</td>
                      <td>
                        <button onClick={() => startEditing(record)} style={{marginRight: '5px'}}>Edit</button>
                        <button onClick={() => handleDelete(record.id)}>Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
