import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import '../styles/UserManagement.css';

const UserManagement = ({ currentUser, userType = 'user' }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: userType === 'admin' ? 'admin' : 'user'
  });
  const [editingUserId, setEditingUserId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let q;
      const usersRef = collection(db, 'users');
      
      if (userType === 'admin') {
        // Show only admin users
        q = query(usersRef, where('role', '==', 'admin'));
      } else {
        // Show only regular users
        q = query(usersRef, where('role', '==', 'user'));
      }
      
      const querySnapshot = await getDocs(q);
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [userType]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const usersRef = collection(db, 'users');
      const userData = {
        ...formData,
        createdAt: new Date().toISOString(),
        isGuest: false
      };

      if (editingUserId) {
        const userRef = doc(db, 'users', editingUserId);
        await updateDoc(userRef, userData);
        alert(`${userType === 'admin' ? 'Admin' : 'User'} updated successfully`);
      } else {
        await addDoc(usersRef, userData);
        alert(`${userType === 'admin' ? 'Admin' : 'User'} added successfully`);
      }

      fetchUsers();
      resetForm();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error saving user:', error);
      alert(`Failed to save ${userType === 'admin' ? 'admin' : 'user'}`);
    }
  };

  const handleEdit = (user) => {
    setFormData({
      email: user.email,
      password: '',
      role: user.role
    });
    setEditingUserId(user.id);
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(`Are you sure you want to delete this ${userType === 'admin' ? 'admin' : 'user'}?`)) {
      try {
        const userRef = doc(db, 'users', id);
        await deleteDoc(userRef);
        alert(`${userType === 'admin' ? 'Admin' : 'User'} deleted successfully`);
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert(`Failed to delete ${userType === 'admin' ? 'admin' : 'user'}`);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      role: userType === 'admin' ? 'admin' : 'user'
    });
    setEditingUserId(null);
  };

  const canManage = () => {
    if (userType === 'admin') {
      return currentUser.role === 'superadmin';
    }
    return ['superadmin', 'admin'].includes(currentUser.role);
  };

  return (
    <div className="user-management-container">
      <div className="user-management-header">
        <h2>{userType === 'admin' ? 'Admin Management' : 'User Management'}</h2>
        {canManage() && (
          <button 
            className="add-user-btn"
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            + Add {userType === 'admin' ? 'Admin' : 'User'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="user-table-container">
          <table className="user-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Created At</th>
                {canManage() && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  {canManage() && (
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="edit-btn"
                          onClick={() => handleEdit(user)}
                        >
                          Edit
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={() => handleDelete(user.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={canManage() ? 4 : 3} className="no-data">
                    No {userType === 'admin' ? 'admins' : 'users'} found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingUserId ? 'Edit' : 'Add'} {userType === 'admin' ? 'Admin' : 'User'}</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingUserId}
                  placeholder={editingUserId ? "Leave blank to keep current password" : ""}
                />
              </div>
              
              <div className="form-group">
                <label>Role:</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                  disabled={userType === 'admin'} // Fixed role for admin section
                >
                  {userType === 'admin' ? (
                    <option value="admin">Admin</option>
                  ) : (
                    <>
                      <option value="user">User</option>
                      {currentUser.role === 'superadmin' && (
                        <option value="admin">Admin</option>
                      )}
                    </>
                  )}
                </select>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  {editingUserId ? 'Update' : 'Add'} {userType === 'admin' ? 'Admin' : 'User'}
                </button>
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;