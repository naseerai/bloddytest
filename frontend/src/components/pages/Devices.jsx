import React, { useState, useEffect } from 'react';
import { realtimeDb } from '../firebase';
import { ref, onValue } from 'firebase/database';
import '../styles/Devices.css';

const Devices = ({ currentUser }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null); // Track selected project

  useEffect(() => {
    if (!currentUser) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    const projectsRef = ref(realtimeDb, 'projects');
    
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        console.log("Fetched data:", data);
        
        if (data) {
          const projectsArray = Object.entries(data).map(([id, project]) => ({
            id,
            name: project.name || 'Unnamed Project',
            description: project.description || 'No description',
            access: project.access || {},
            devices: getDevicesFromProject(project),
            alerts: project.alerts ? Object.values(project.alerts) : []
          }));
          setProjects(projectsArray);
        } else {
          setProjects([]);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error processing data:", err);
        setError(err.message);
        setLoading(false);
      }
    }, (error) => {
      console.error("Firebase error:", error);
      setError(error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const getDevicesFromProject = (project) => {
    try {
      if (project.devices) return Object.entries(project.devices).map(([id, device]) => ({ id, ...device }));
      if (project.vehicles) return Object.entries(project.vehicles).map(([id, vehicle]) => ({ id, type: 'vehicle', ...vehicle }));
      if (project.sensors) return Object.entries(project.sensors).map(([id, sensor]) => ({ id, type: 'sensor', ...sensor }));
      return [];
    } catch (error) {
      console.error("Error extracting devices:", error);
      return [];
    }
  };

  const filteredProjects = projects.filter(project => {
    try {
      if (!currentUser || !currentUser.role) return false;
      if (!project.access) return true;
      return project.access[currentUser.role] || project.access.guest;
    } catch (error) {
      console.error("Error filtering projects:", error);
      return false;
    }
  });

  const handleBackToList = () => {
    setSelectedProject(null);
  };

  if (loading) return (
    <div className="content-card">
      <h2>Loading IoT Projects...</h2>
      <p>Please wait while we fetch your devices.</p>
    </div>
  );

  if (error) return (
    <div className="content-card error">
      <h2>Error Loading Devices</h2>
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Reload Page</button>
    </div>
  );

  // Render detailed view if a project is selected
  if (selectedProject) {
    return (
      <div className="content-card">
        <button onClick={handleBackToList} className="back-button">
          &larr; Back to Projects
        </button>
        
        <h2>{selectedProject.name}</h2>
        <p className="project-description">{selectedProject.description}</p>
        
        <div className="project-details">
          <h3>Devices ({selectedProject.devices.length})</h3>
          <div className="devices-grid">
            {selectedProject.devices.map(device => (
              <div key={device.id} className="device-card">
                <h4>{device.id}</h4>
                <p>Type: {device.type || 'device'}</p>
                <p>Status: {device.status || 'no status'}</p>
                {device.lastSeen && <p>Last seen: {device.lastSeen}</p>}
              </div>
            ))}
          </div>
          
          {selectedProject.alerts.length > 0 && (
            <>
              <h3>Alerts ({selectedProject.alerts.length})</h3>
              <div className="alerts-grid">
                {selectedProject.alerts.map((alert, index) => (
                  <div key={index} className={`alert-card alert-${alert.priority || 'medium'}`}>
                    <h4>{alert.title || 'Alert'}</h4>
                    <p>{alert.message}</p>
                    {alert.timestamp && <p>Time: {alert.timestamp}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render projects list if no project is selected
  return (
    <div className="content-card">
      <h2>IoT Projects</h2>
      
      {filteredProjects.length === 0 ? (
        <div>
          <p>No IoT projects found that match your access level.</p>
          {projects.length > 0 && (
            <p>Found {projects.length} total projects, but none match your access permissions.</p>
          )}
          <button onClick={() => {
            setLoading(true);
            setError(null);
            window.location.reload();
          }}>
            Refresh Data
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map(project => (
            <div key={project.id} className="project-card">
              <h3>{project.name}</h3>
              <p className="project-description">{project.description}</p>
              
              <div className="project-access">
                <span>Access: {Object.keys(project.access || {}).filter(k => project.access[k]).join(', ') || 'All users'}</span>
              </div>
              
              {project.devices.length > 0 && (
                <div className="devices-section">
                  <h4>Devices ({project.devices.length})</h4>
                  <ul className="devices-list">
                    {project.devices.slice(0, 3).map(device => (
                      <li key={device.id}>
                        <strong>{device.id}</strong>: {device.type || 'device'} - {device.status || 'no status'}
                      </li>
                    ))}
                    {project.devices.length > 3 && <li>+{project.devices.length - 3} more...</li>}
                  </ul>
                </div>
              )}
              
              {project.alerts.length > 0 && (
                <div className="alerts-section">
                  <h4>Alerts ({project.alerts.length})</h4>
                  <ul className="alerts-list">
                    {project.alerts.slice(0, 2).map((alert, index) => (
                      <li key={index} className={`alert-${alert.priority || 'medium'}`}>
                        {alert.message}
                      </li>
                    ))}
                    {project.alerts.length > 2 && <li>+{project.alerts.length - 2} more alerts...</li>}
                  </ul>
                </div>
              )}
              
              <button 
                className="view-details-btn"
                onClick={() => setSelectedProject(project)}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Devices;