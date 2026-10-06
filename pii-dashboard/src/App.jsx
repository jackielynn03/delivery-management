import React, { useState, useEffect } from 'react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [piiData, setPiiData] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Modal States
  const [selectedRecord, setSelectedRecord] = useState(null); // For View Popup
  const [unmaskedFields, setUnmaskedFields] = useState({});   // Tracks which fields are unmasked in the popup
  const [isAdding, setIsAdding] = useState(false);            // For Add Popup
  const [editingId, setEditingId] = useState(null);           // For Edit Popup

  // Search filters (only for visible columns)
  const [filters, setFilters] = useState({ id: '', order_id: '', order_name: '' });

  // Consolidated Form State
  const emptyForm = { order_id: '', name: '', order_name: '', social_security_number: '', driver_license: '', dob: '', phone_number: '', credit_card_number_visa: '', credit_card_number_master: '', address: '', resident_registration_number: '', business_registration_number: '' };
  const [formData, setFormData] = useState(emptyForm);

  // --- Auth ---
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
  const handleSaveForm = async () => {
    const isEditing = editingId !== null;
    const url = isEditing ? `/api/deliveries/${editingId}` : '/api/deliveries';
    const method = isEditing ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      const savedRecord = await response.json();
      if (isEditing) {
        setPiiData(piiData.map(item => item.id === editingId ? savedRecord : item));
      } else {
        setPiiData([...piiData, savedRecord]);
      }
      closeFormModal();
    } else {
      setError('Failed to save record.');
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

  const openEditModal = (record) => {
    setEditingId(record.id);
    setFormData({
      order_id: record.order_id || '', name: record.name || '', order_name: record.order_name || '', social_security_number: record.social_security_number || '',
      driver_license: record.driver_license || '', dob: record.dob ? record.dob.split('T')[0] : '',
      phone_number: record.phone_number || '', credit_card_number_visa: record.credit_card_number_visa || '', credit_card_number_master: record.credit_card_number_master || '',
      address: record.address || '', resident_registration_number: record.resident_registration_number || '', business_registration_number: record.business_registration_number || ''
    });
  };

  const closeFormModal = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const openDetailsModal = (record) => {
    setSelectedRecord(record);
    setUnmaskedFields({}); // Reset masking when opening a new record
  };

  const closeDetailsModal = () => {
    setSelectedRecord(null);
    setUnmaskedFields({});
  };

  // --- Filtering & Export ---
  const filteredData = piiData.filter((record) => {
    return Object.keys(filters).every((key) => {
      if (!filters[key]) return true;
      const recordValue = record[key] ? String(record[key]).toLowerCase() : '';
      return recordValue.includes(filters[key].toLowerCase());
    });
  });

  const exportToCSV = () => {
    const headers = ['ID', 'Order ID', 'Name', 'Order Name', 'SSN', 'Driver License', 'DOB', 'Phone Number', 'Visa', 'Mastercard', 'Address', 'Resident Reg', 'Business Reg'];
    const csvRows = [headers.join(',')];
    filteredData.forEach(row => {
      const values = [
        row.id, row.order_id, row.name, row.order_name, row.social_security_number, row.driver_license,
        row.dob ? new Date(row.dob).toLocaleDateString() : '', row.phone_number, row.credit_card_number_visa, row.credit_card_number_master, 
        row.address, row.resident_registration_number, row.business_registration_number
      ].map(val => `"${val || ''}"`); 
      csvRows.push(values.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deliveries_export.csv';
    a.click();
  };

  // --- Masking Logic for Popup ---
  const toggleMask = (fieldKey) => {
    setUnmaskedFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const renderMaskedField = (value, label, fieldKey) => {
    const isUnmasked = unmaskedFields[fieldKey];
    let displayValue = value ? String(value) : 'N/A';
    
    if (!isUnmasked && displayValue !== 'N/A') {
      displayValue = displayValue.length > 4 ? `***-***-${displayValue.slice(-4)}` : '***';
    }
    
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '10px 0', alignItems: 'center' }}>
        <div><strong>{label}:</strong> <span style={{ marginLeft: '10px', fontFamily: 'monospace', fontSize: '14px' }}>{displayValue}</span></div>
        <button 
          onClick={() => toggleMask(fieldKey)} 
          style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', background: isUnmasked ? '#dc3545' : '#17a2b8', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {isUnmasked ? 'Mask' : 'Unmask'}
        </button>
      </div>
    );
  };

  // --- Styles ---
  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
  const modalContentStyle = { backgroundColor: '#fff', padding: '25px', borderRadius: '8px', width: '600px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
  const clickableStyle = { cursor: 'pointer', color: '#007bff', textDecoration: 'underline' };
  const inputStyle = { width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' };

  // --- Render Auth Screen ---
  if (!token) {
    return (
      <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
        <h2>{isRegistering ? 'Register New Account' : 'System Login'}</h2>
        {successMsg && <p style={{color: 'green'}}>{successMsg}</p>}
        {error && <p style={{color: 'red'}}>{error}</p>}
        {isRegistering ? (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" name="username" placeholder="Choose a Username" required style={inputStyle} />
            <input type="password" name="password" placeholder="Choose a Password" required style={inputStyle} />
            <button type="submit">Register</button>
            <button type="button" onClick={() => setIsRegistering(false)}>Back to Login</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" name="username" placeholder="Username" required style={inputStyle} />
            <input type="password" name="password" placeholder="Password" required style={inputStyle} />
            <button type="submit">Log In</button>
            <button type="button" onClick={() => setIsRegistering(true)}>Need an account? Register</button>
          </form>
        )}
      </div>
    );
  }

  // --- Render Dashboard ---
  return (
    <div style={{ padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>PII Management Dashboard</h2>
        <div>
          <button onClick={() => setIsAdding(true)} style={{ marginRight: '10px', background: '#007bff', color: 'white' }}>+ Add New Record</button>
          <button onClick={exportToCSV} style={{ marginRight: '10px', background: '#28a745', color: 'white' }}>Export to CSV</button>
          <button onClick={handleLogout} style={{ background: '#6c757d', color: 'white' }}>Log Out</button>
        </div>
      </header>
      
      {error && <p style={{color: 'red'}}>{error}</p>}

      {/* Main Simplified Table */}
      <div style={{ overflowX: 'auto', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '15px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px' }}>ID</th>
              <th style={{ padding: '12px' }}>Order ID</th>
              <th style={{ padding: '12px' }}>Order Name</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
            <tr style={{ backgroundColor: '#f1f3f5' }}>
              <th style={{ padding: '8px' }}><input type="text" name="id" value={filters.id} onChange={(e) => setFilters({ ...filters, id: e.target.value })} placeholder="Filter ID..." style={inputStyle} /></th>
              <th style={{ padding: '8px' }}><input type="text" name="order_id" value={filters.order_id} onChange={(e) => setFilters({ ...filters, order_id: e.target.value })} placeholder="Filter Order ID..." style={inputStyle} /></th>
              <th style={{ padding: '8px' }}><input type="text" name="order_name" value={filters.order_name} onChange={(e) => setFilters({ ...filters, order_name: e.target.value })} placeholder="Filter Order Name..." style={inputStyle} /></th>
              <th style={{ padding: '8px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map(record => (
              <tr key={record.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', ...clickableStyle }} onClick={() => openDetailsModal(record)}>{record.id}</td>
                <td style={{ padding: '12px', ...clickableStyle }} onClick={() => openDetailsModal(record)}>{record.order_id}</td>
                <td style={{ padding: '12px', ...clickableStyle }} onClick={() => openDetailsModal(record)}>{record.order_name}</td>
                <td style={{ padding: '12px' }}>
                  <button onClick={() => openEditModal(record)} style={{ marginRight: '8px', padding: '4px 10px' }}>Edit</button>
                  <button onClick={() => handleDelete(record.id)} style={{ padding: '4px 10px', background: '#dc3545', color: 'white', border: 'none' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* VIEW DETAILS POPUP MODAL */}
      {selectedRecord && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>Delivery Details</h3>
            
            <div style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}><strong>ID:</strong> {selectedRecord.id}</div>
            <div style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}><strong>ORDER ID:</strong> {selectedRecord.order_id}</div>
            <div style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}><strong>ORDER NAME:</strong> {selectedRecord.order_name}</div>
            
            {/* Individually Masked Fields */}
            {renderMaskedField(selectedRecord.name, 'Name', 'name')}
            {renderMaskedField(selectedRecord.social_security_number, 'SSN', 'social_security_number')}
            {renderMaskedField(selectedRecord.driver_license, 'Driver License', 'driver_license')}
            {renderMaskedField(selectedRecord.dob ? selectedRecord.dob.split('T')[0] : '', 'Date of Birth', 'dob')}
            {renderMaskedField(selectedRecord.phone_number, 'Phone Number', 'phone_number')}
            {renderMaskedField(selectedRecord.credit_card_number_visa, 'Visa Card', 'credit_card_number_visa')}
            {renderMaskedField(selectedRecord.credit_card_number_master, 'Mastercard', 'credit_card_number_master')}
            {renderMaskedField(selectedRecord.address, 'Address', 'address')}
            {renderMaskedField(selectedRecord.resident_registration_number, 'Resident Registration', 'resident_registration_number')}
            {renderMaskedField(selectedRecord.business_registration_number, 'Business Registration', 'business_registration_number')}
            
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button onClick={closeDetailsModal} style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT FORM POPUP MODAL */}
      {(isAdding || editingId) && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>{isAdding ? 'Add New Delivery Record' : 'Edit Delivery Record'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px' }}>
              <div><label>Order ID</label><input type="text" style={inputStyle} value={formData.order_id} onChange={(e) => setFormData({...formData, order_id: e.target.value})} /></div>
              <div><label>Order Name</label><input type="text" style={inputStyle} value={formData.order_name} onChange={(e) => setFormData({...formData, order_name: e.target.value})} /></div>
              <div><label>Name</label><input type="text" style={inputStyle} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
              <div><label>SSN</label><input type="text" style={inputStyle} value={formData.social_security_number} onChange={(e) => setFormData({...formData, social_security_number: e.target.value})} /></div>
              <div><label>Driver License</label><input type="text" style={inputStyle} value={formData.driver_license} onChange={(e) => setFormData({...formData, driver_license: e.target.value})} /></div>
              <div><label>Date of Birth</label><input type="date" style={inputStyle} value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} /></div>
              <div><label>Phone Number</label><input type="text" style={inputStyle} value={formData.phone_number} onChange={(e) => setFormData({...formData, phone_number: e.target.value})} /></div>
              <div><label>Visa Card</label><input type="text" style={inputStyle} value={formData.credit_card_number_visa} onChange={(e) => setFormData({...formData, credit_card_number_visa: e.target.value})} /></div>
              <div><label>Mastercard</label><input type="text" style={inputStyle} value={formData.credit_card_number_master} onChange={(e) => setFormData({...formData, credit_card_number_master: e.target.value})} /></div>
              <div><label>Resident Reg</label><input type="text" style={inputStyle} value={formData.resident_registration_number} onChange={(e) => setFormData({...formData, resident_registration_number: e.target.value})} /></div>
              <div><label>Business Reg</label><input type="text" style={inputStyle} value={formData.business_registration_number} onChange={(e) => setFormData({...formData, business_registration_number: e.target.value})} /></div>
              <div style={{ gridColumn: 'span 2' }}><label>Address</label><input type="text" style={inputStyle} value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} /></div>
            </div>
            
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button onClick={closeFormModal} style={{ padding: '8px 16px', marginRight: '10px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveForm} style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}