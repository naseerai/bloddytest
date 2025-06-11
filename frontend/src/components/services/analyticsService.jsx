// services/analyticsService.js
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust path to your Firebase config

export class AnalyticsService {
  
  // Fetch analytics data with filtering options
  static async fetchAnalyticsData(filters = {}) {
    try {
      const logsCollection = collection(db, 'project_access_logs');
      
      // Build query with filters
      let constraints = [];
      
      // Date range filter
      if (filters.startDate) {
        constraints.push(where('timestamp', '>=', filters.startDate));
      }
      if (filters.endDate) {
        constraints.push(where('timestamp', '<=', filters.endDate));
      }
      
      // User role filter
      if (filters.userRole) {
        constraints.push(where('userRole', '==', filters.userRole));
      }
      
      // Project filter
      if (filters.projectId) {
        constraints.push(where('projectId', '==', filters.projectId));
      }
      
      // User email filter (for specific user analytics)
      if (filters.userEmail) {
        constraints.push(where('userEmail', '==', filters.userEmail));
      }
      
      // Add ordering and limit
      constraints.push(orderBy('timestamp', 'desc'));
      constraints.push(limit(filters.limit || 1000));
      
      const logsQuery = query(logsCollection, ...constraints);
      const querySnapshot = await getDocs(logsQuery);
      
      const logs = [];
      querySnapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return this.processAnalyticsData(logs, filters);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      throw error;
    }
  }

  // Enhanced process analytics data with role-based filtering
  static processAnalyticsData(logs, filters = {}) {
    return {
      dailyAccess: this.getDailyAccessData(logs, filters.days || 7),
      projectAccess: this.getProjectAccessData(logs),
      userRoleDistribution: this.getUserRoleDistribution(logs),
      hourlyAccess: this.getHourlyAccessData(logs),
      weeklyAccess: this.getWeeklyAccessData(logs),
      monthlyAccess: this.getMonthlyAccessData(logs),
      topUsers: this.getTopUsers(logs),
      sessionDuration: this.getSessionDurationData(logs)
    };
  }

  // Get daily access data for specified number of days (default 7)
  static getDailyAccessData(logs, days = 7) {
    const dailyData = [];
    const now = new Date();
    
    // Create array of last N days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      dailyData.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        accesses: 0,
        uniqueUsers: new Set()
      });
    }

    // Count accesses for each day
    logs.forEach(log => {
      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
      const dayData = dailyData.find(day => day.date === logDate);
      if (dayData) {
        dayData.accesses++;
        if (log.userEmail) {
          dayData.uniqueUsers.add(log.userEmail);
        }
      }
    });

    // Convert Set to count
    return dailyData.map(day => ({
      ...day,
      uniqueUsers: day.uniqueUsers.size
    }));
  }

  // Get weekly access data for last 4 weeks
  static getWeeklyAccessData(logs) {
    const weeklyData = [];
    const now = new Date();
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      weeklyData.push({
        week: `Week ${4 - i}`,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        accesses: 0,
        uniqueUsers: new Set()
      });
    }

    logs.forEach(log => {
      const logDate = new Date(log.timestamp);
      weeklyData.forEach(week => {
        const weekStart = new Date(week.startDate);
        const weekEnd = new Date(week.endDate);
        if (logDate >= weekStart && logDate <= weekEnd) {
          week.accesses++;
          if (log.userEmail) {
            week.uniqueUsers.add(log.userEmail);
          }
        }
      });
    });

    return weeklyData.map(week => ({
      ...week,
      uniqueUsers: week.uniqueUsers.size
    }));
  }

  // Get monthly access data for last 6 months
  static getMonthlyAccessData(logs) {
    const monthlyData = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyData.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthYear: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
        accesses: 0,
        uniqueUsers: new Set()
      });
    }

    logs.forEach(log => {
      const logDate = new Date(log.timestamp);
      const logMonthYear = `${logDate.getFullYear()}-${(logDate.getMonth() + 1).toString().padStart(2, '0')}`;
      const monthData = monthlyData.find(month => month.monthYear === logMonthYear);
      if (monthData) {
        monthData.accesses++;
        if (log.userEmail) {
          monthData.uniqueUsers.add(log.userEmail);
        }
      }
    });

    return monthlyData.map(month => ({
      ...month,
      uniqueUsers: month.uniqueUsers.size
    }));
  }

  // Get project access distribution with enhanced data
  static getProjectAccessData(logs) {
    const projectCounts = {};
    const projectUsers = {};
    const projectSessions = {};
    
    logs.forEach(log => {
      if (log.projectId) {
        projectCounts[log.projectId] = (projectCounts[log.projectId] || 0) + 1;
        
        if (!projectUsers[log.projectId]) {
          projectUsers[log.projectId] = new Set();
        }
        if (log.userEmail) {
          projectUsers[log.projectId].add(log.userEmail);
        }
        
        if (!projectSessions[log.projectId]) {
          projectSessions[log.projectId] = new Set();
        }
        if (log.sessionId) {
          projectSessions[log.projectId].add(log.sessionId);
        }
      }
    });

    return Object.entries(projectCounts).map(([project, accesses]) => ({
      project: project.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      accesses,
      projectId: project,
      uniqueUsers: projectUsers[project] ? projectUsers[project].size : 0,
      sessions: projectSessions[project] ? projectSessions[project].size : 0
    })).sort((a, b) => b.accesses - a.accesses);
  }

  // Get user role distribution with enhanced data
  static getUserRoleDistribution(logs) {
    const roleCounts = {};
    const uniqueUsers = new Set();
    
    logs.forEach(log => {
      if (log.userEmail && log.userRole) {
        const userKey = `${log.userEmail}-${log.userRole}`;
        if (!uniqueUsers.has(userKey)) {
          uniqueUsers.add(userKey);
          roleCounts[log.userRole] = (roleCounts[log.userRole] || 0) + 1;
        }
      }
    });

    const total = Object.values(roleCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(roleCounts).map(([role, count]) => ({
      role: role.charAt(0).toUpperCase() + role.slice(1),
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }));
  }

  // Get hourly access pattern for today or specified date
  static getHourlyAccessData(logs, targetDate = null) {
    const hourlyData = [];
    const today = targetDate || new Date().toISOString().split('T')[0];
    
    // Initialize 24 hours
    for (let hour = 0; hour < 24; hour++) {
      hourlyData.push({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        accesses: 0,
        uniqueUsers: new Set()
      });
    }

    // Count accesses for each hour
    logs.forEach(log => {
      const logDate = new Date(log.timestamp);
      const logDateStr = logDate.toISOString().split('T')[0];
      
      if (logDateStr === today) {
        const hour = logDate.getHours();
        hourlyData[hour].accesses++;
        if (log.userEmail) {
          hourlyData[hour].uniqueUsers.add(log.userEmail);
        }
      }
    });

    return hourlyData.map(hour => ({
      ...hour,
      uniqueUsers: hour.uniqueUsers.size
    }));
  }

  // Get top users by activity
  static getTopUsers(logs, limit = 10) {
    const userActivity = {};
    
    logs.forEach(log => {
      if (log.userEmail) {
        if (!userActivity[log.userEmail]) {
          userActivity[log.userEmail] = {
            email: log.userEmail,
            role: log.userRole || 'unknown',
            accesses: 0,
            projects: new Set(),
            lastAccess: log.timestamp
          };
        }
        
        userActivity[log.userEmail].accesses++;
        if (log.projectId) {
          userActivity[log.userEmail].projects.add(log.projectId);
        }
        
        // Keep the most recent access time
        if (new Date(log.timestamp) > new Date(userActivity[log.userEmail].lastAccess)) {
          userActivity[log.userEmail].lastAccess = log.timestamp;
        }
      }
    });

    return Object.values(userActivity)
      .map(user => ({
        ...user,
        projects: user.projects.size,
        lastAccess: new Date(user.lastAccess).toLocaleDateString()
      }))
      .sort((a, b) => b.accesses - a.accesses)
      .slice(0, limit);
  }

  // Get session duration data (if available in logs)
  static getSessionDurationData(logs) {
    const sessionDurations = {};
    
    logs.forEach(log => {
      if (log.sessionId && log.sessionDuration) {
        if (!sessionDurations[log.sessionId]) {
          sessionDurations[log.sessionId] = {
            sessionId: log.sessionId,
            duration: log.sessionDuration,
            projectId: log.projectId,
            userRole: log.userRole,
            timestamp: log.timestamp
          };
        }
      }
    });

    const durations = Object.values(sessionDurations);
    
    // Calculate average duration by role
    const roleAverages = {};
    durations.forEach(session => {
      if (!roleAverages[session.userRole]) {
        roleAverages[session.userRole] = { total: 0, count: 0 };
      }
      roleAverages[session.userRole].total += session.duration;
      roleAverages[session.userRole].count++;
    });

    return {
      sessions: durations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      roleAverages: Object.entries(roleAverages).map(([role, data]) => ({
        role,
        averageDuration: Math.round(data.total / data.count)
      }))
    };
  }

  // Get recent logs with enhanced filtering
  static async getRecentLogs(hours = 24, filters = {}) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hours);
      
      const logsCollection = collection(db, 'project_access_logs');
      let constraints = [
        where('timestamp', '>=', cutoffTime.toISOString()),
        orderBy('timestamp', 'desc')
      ];
      
      // Add additional filters
      if (filters.userRole) {
        constraints.splice(-2, 0, where('userRole', '==', filters.userRole));
      }
      if (filters.projectId) {
        constraints.splice(-2, 0, where('projectId', '==', filters.projectId));
      }
      if (filters.userEmail) {
        constraints.splice(-2, 0, where('userEmail', '==', filters.userEmail));
      }
      
      const recentQuery = query(logsCollection, ...constraints);
      const querySnapshot = await getDocs(recentQuery);
      const recentLogs = [];
      
      querySnapshot.forEach((doc) => {
        recentLogs.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return recentLogs;
    } catch (error) {
      console.error('Error fetching recent logs:', error);
      throw error;
    }
  }

  // Get statistics summary with role-based insights
  static getStatsSummary(logs, userRole = null) {
    const uniqueUsers = new Set(logs.map(log => log.userEmail)).size;
    const uniqueProjects = new Set(logs.map(log => log.projectId)).size;
    const totalSessions = logs.length;
    
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = logs.filter(log => 
      new Date(log.timestamp).toISOString().split('T')[0] === today
    ).length;

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    const weekSessions = logs.filter(log => 
      new Date(log.timestamp) >= thisWeek
    ).length;

    // Role-specific stats
    let roleSpecificStats = {};
    if (userRole && userRole !== 'superadmin') {
      const userLogs = logs.filter(log => log.userRole === userRole);
      roleSpecificStats = {
        roleUsers: new Set(userLogs.map(log => log.userEmail)).size,
        roleSessions: userLogs.length,
        roleProjects: new Set(userLogs.map(log => log.projectId)).size
      };
    }

    return {
      totalUsers: uniqueUsers,
      totalProjects: uniqueProjects,
      totalSessions,
      todaySessions,
      weekSessions,
      ...roleSpecificStats
    };
  }

  // Get filtered data based on user role and permissions
  static async fetchRoleBasedAnalytics(userRole, userEmail = null, filters = {}) {
    const baseFilters = { ...filters };
    
    // Apply role-based filtering
    switch (userRole) {
      case 'superadmin':
        // Superadmin can see all data
        break;
      case 'admin':
        // Admin can see all data but might have different default views
        break;
      case 'user':
        break;
      case 'guest':
        // Guests shouldn't access analytics
        throw new Error('Guests do not have access to analytics data');
      default:
        throw new Error('Invalid user role');
    }

    return await this.fetchAnalyticsData(baseFilters);
  }
}