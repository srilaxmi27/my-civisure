// ========================
// CIVISURE - MAIN JAVASCRIPT
// ========================

const API_BASE = '/api';

const utils = {
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    showToast: (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        const colors = {
            success: { bg: '#d1fae5', color: '#065f46' },
            error: { bg: '#fee2e2', color: '#991b1b' },
            warning: { bg: '#fef3c7', color: '#92400e' },
            info: { bg: '#dbeafe', color: '#1e40af' }
        };

        toast.style.backgroundColor = colors[type].bg;
        toast.style.color = colors[type].color;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    },

    hideModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    },

    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    getCurrentLocation: () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => reject(error)
            );
        });
    },

    reverseGeocode: async (lat, lng) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
            );
            const data = await response.json();
            return data.display_name || 'Unknown location';
        } catch (error) {
            console.error('Reverse geocode error:', error);
            return 'Unknown location';
        }
    },

    debounce: (func, wait) => {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    },

    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
};

const auth = {
    checkAuth: async () => {
        try {
            const response = await fetch(`${API_BASE}/auth/check`);
            const data = await response.json();
            return data.authenticated ? data.user : null;
        } catch (error) {
            console.error('Auth check error:', error);
            return null;
        }
    },

    logout: async () => {
        try {
            const response = await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
            const data = await response.json();
            if (data.success) window.location.href = '/index.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    requireAuth: async () => {
        const user = await auth.checkAuth();
        if (!user) {
            window.location.href = '/login.html';
            return null;
        }
        return user;
    },

    requireAdmin: async () => {
        const user = await auth.requireAuth();
        if (user && user.role !== 'admin') {
            window.location.href = '/dashboard.html';
            return null;
        }
        return user;
    }
};

const api = {
    get: async (endpoint) => {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`);
            return await response.json();
        } catch (error) {
            console.error('API GET error:', error);
            throw error;
        }
    },

    post: async (endpoint, data) => {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('API POST error:', error);
            throw error;
        }
    },

    put: async (endpoint, data) => {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('API PUT error:', error);
            throw error;
        }
    },

    delete: async (endpoint) => {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('API DELETE error:', error);
            throw error;
        }
    },

    uploadFile: async (endpoint, formData) => {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('API upload error:', error);
            throw error;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', () => {
            button.closest('.modal').classList.remove('active');
        });
    });

    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => {
            const requiredFields = form.querySelectorAll('[required]');
            let valid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    valid = false;
                    field.classList.add('error');
                } else {
                    field.classList.remove('error');
                }
            });

            if (!valid) {
                e.preventDefault();
                utils.showToast('Please fill in all required fields', 'error');
            }
        });
    });
});

const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}`;
document.head.appendChild(style);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { utils, auth, api };
}
