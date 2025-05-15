const axios = require('axios');
const qs = require('qs');
const { query } = require('../db');

class SallaAPI {
    constructor(merchantId, accessToken, refreshToken = null) {
        this.baseURL = 'https://api.salla.dev/admin/v2';
        this.merchantId = merchantId;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.timeout = 10000;
    }

    async refreshAccessToken() {
        try {
            if (!this.refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await axios.post('https://accounts.salla.sa/oauth2/token', 
                qs.stringify({
                    client_id: process.env.SALLA_CLIENT_ID,
                    client_secret: process.env.SALLA_CLIENT_SECRET,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token'
                }), {
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            if (!response.data.access_token) {
                throw new Error('Invalid token response');
            }

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token || this.refreshToken;

            await query(
                `UPDATE connected_stores 
                 SET access_token = ?, 
                     refresh_token = ?, 
                     token_expiry = DATE_ADD(NOW(), INTERVAL ? SECOND)
                 WHERE merchant_id = ?`,
                [
                    this.accessToken,
                    this.refreshToken,
                    response.data.expires_in || 3600,
                    this.merchantId
                ]
            );

            console.log('Token refreshed successfully for merchant:', this.merchantId);
            return true;
        } catch (error) {
            console.error('Refresh token failed:', {
                merchantId: this.merchantId,
                error: error.response?.data || error.message
            });
            
            if (error.response?.data?.error === 'invalid_grant') {
                await query(
                    `UPDATE connected_stores 
                     SET refresh_token = NULL 
                     WHERE merchant_id = ?`,
                    [this.merchantId]
                );
            }
            
            return false;
        }
    }

    async getRequest(endpoint, params = {}) {
        try {
            const response = await this.makeRequest('GET', endpoint, { params });
            return this.validateResponse(response);
        } catch (error) {
            return this.handleRetry(error, endpoint, params);
        }
    }

    async postRequest(endpoint, data = {}) {
        try {
            const response = await this.makeRequest('POST', endpoint, { data });
            return this.validateResponse(response);
        } catch (error) {
            return this.handleRetry(error, endpoint, null, data);
        }
    }

    async makeRequest(method, endpoint, config = {}) {
        return await axios({
            method,
            url: `${this.baseURL}${endpoint}`,
            headers: this.getHeaders(),
            timeout: this.timeout,
            ...config
        });
    }

    validateResponse(response) {
        if (!response.data || !response.data.data) {
            throw new Error('Invalid API response structure');
        }
        return response.data.data;
    }

    async handleRetry(error, endpoint, params, data = null) {
        if (error.response?.status === 401 && this.refreshToken) {
            try {
                const tokenRefreshed = await this.refreshAccessToken();
                if (tokenRefreshed) {
                    const retryConfig = {
                        headers: this.getHeaders(),
                        timeout: this.timeout,
                        ...(params && { params }),
                        ...(data && { data })
                    };

                    const method = error.config?.method || 'GET';
                    const retryResponse = await axios({
                        method,
                        url: `${this.baseURL}${endpoint}`,
                        ...retryConfig
                    });

                    return this.validateResponse(retryResponse);
                }
            } catch (refreshError) {
                this.handleAPIError(refreshError, endpoint);
                throw new Error('Failed to refresh token: ' + refreshError.message);
            }
        }

        this.handleAPIError(error, endpoint);
        throw error;
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Merchant-ID': this.merchantId
        };
    }

    handleAPIError(error, endpoint) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(`API Error at ${endpoint}:`, errorMessage);
        
        const errorDetails = {
            endpoint,
            status: error.response?.status,
            error: typeof errorMessage === 'string' ? 
                errorMessage.substring(0, 255) : 
                JSON.stringify(errorMessage).substring(0, 255),
            merchantId: this.merchantId,
            timestamp: new Date().toISOString()
        };

        console.error('Salla API Error:', errorDetails);
        
        query(
            `INSERT INTO api_errors 
            (merchant_id, endpoint, error_message, status_code, created_at)
            VALUES (?, ?, ?, ?, NOW())`,
            [
                this.merchantId || null,
                endpoint,
                errorDetails.error,
                errorDetails.status || 0
            ]
        ).catch(dbError => {
            console.error('DB Error Logging Failed:', dbError.message);
        });
    }

    async getAbandonedCarts(period = 'weekly') {
        const endpoint = '/orders';
        try {
            const params = {
                status: 'pending',
                limit: 50,
                ...this.getPeriodParams(period)
            };
            const data = await this.getRequest(endpoint, params);
            console.log('Abandoned carts data fetched:', data);
            return this.processCartsData(data);
        } catch (error) {
            console.error('Failed to fetch abandoned carts:', {
                merchantId: this.merchantId,
                error: error.message,
                status: error.response?.status
            });
            if (error.response?.status === 404) {
                console.warn('Abandoned carts endpoint not available, returning empty list');
                return [];
            }
            if (error.response?.status === 401) {
                throw new Error('Unauthorized: Invalid or expired token');
            }
            if (error.response?.status === 403) {
                throw new Error('Forbidden: Missing required permissions');
            }
            throw error;
        }
    }

    async getCustomers(limit = 100) {
        const endpoint = '/customers';
        try {
            const params = { limit };
            const data = await this.getRequest(endpoint, params);
            return this.processCustomersData(data);
        } catch (error) {
            console.error('Failed to fetch customers:', {
                merchantId: this.merchantId,
                error: error.message
            });
            return [];
        }
    }

    processCartsData(data) {
        if (!Array.isArray(data)) {
            console.warn('No abandoned carts data returned:', data);
            return [];
        }

        const processedCarts = data.map(cart => ({
            id: cart.id,
            cart_id: cart.order_id || cart.id,
            customer_name: cart.customer?.name || 'زائر',
            customer_phone: cart.customer?.mobile || null,
            customer_image: cart.customer?.avatar || null,
            total: cart.amount?.total || cart.total || 0,
            products_count: cart.items?.length || 0,
            created_at: cart.created_at || new Date().toISOString(),
            last_sync_at: new Date().toISOString(),
            status: cart.status || 'pending'
        }));

        console.log('Processed abandoned carts:', processedCarts);
        return processedCarts;
    }

    processCustomersData(data) {
        if (!Array.isArray(data)) return [];

        return data.map(customer => ({
            id: customer.id,
            name: customer.name || 'زائر',
            mobile: customer.mobile,
            email: customer.email,
            total_orders: customer.orders_count || 0,
            total_spent: customer.total_spent || 0,
            last_order_date: customer.last_order_date,
            created_at: customer.created_at || new Date().toISOString()
        }));
    }

    async getMessagesStats() {
        const endpoint = '/messages/stats';
        try {
            const stats = await this.getRequest(endpoint);
            return {
                sent: stats.sent || 0,
                read: stats.read || 0,
                read_rate: stats.read_rate || 0
            };
        } catch (error) {
            console.error('Failed to fetch messages stats:', error.message);
            return { sent: 0, read: 0, read_rate: 0 };
        }
    }

    getPeriodParams(period) {
        const now = new Date();
        const fromDate = new Date();

        switch (period.toLowerCase()) {
            case 'daily':
                fromDate.setDate(now.getDate() - 1);
                break;
            case 'weekly':
                fromDate.setDate(now.getDate() - 7);
                break;
            case 'monthly':
                fromDate.setMonth(now.getMonth() - 1);
                break;
            case 'yearly':
                fromDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                fromDate.setDate(now.getDate() - 7);
        }

        return {
            created_at_min: fromDate.toISOString(),
            created_at_max: now.toISOString(),
            period: period.toLowerCase()
        };
    }

    async verifyToken() {
        try {
            const response = await axios.get(`${this.baseURL}/store/info`, {
                headers: this.getHeaders(),
                timeout: this.timeout
            });
            return !!response.data.data;
        } catch (error) {
            console.error('Token verification failed:', error.message);
            return false;
        }
    }

    async checkPermissions() {
        const requiredScopes = ['offline_access', 'read_orders', 'read_customers'];
        try {
            const tokenInfo = await axios.get('https://accounts.salla.sa/oauth2/token-info', {
                params: { access_token: this.accessToken },
                timeout: this.timeout
            });
            
            const missingScopes = requiredScopes.filter(s => !tokenInfo.data.scopes.includes(s));
            if (missingScopes.length > 0) {
                throw new Error(`Missing required scopes: ${missingScopes.join(', ')}`);
            }
            return true;
        } catch (error) {
            console.error('Permission check failed:', error.message);
            throw error;
        }
    }
}

module.exports = {
    SallaAPI,
    
    initializeAPI: (merchantId, accessToken, refreshToken) => {
        return new SallaAPI(merchantId, accessToken, refreshToken);
    },

    getAbandonedCarts: async (merchantId, token, period) => {
        const api = new SallaAPI(merchantId, token);
        return api.getAbandonedCarts(period);
    },

    getCustomers: async (merchantId, token, limit = 100) => {
        const api = new SallaAPI(merchantId, token);
        return api.getCustomers(limit);
    },

    getMessagesStats: async (merchantId, token) => {
        const api = new SallaAPI(merchantId, token);
        return api.getMessagesStats();
    },

    verifyAccessToken: async (merchantId, token) => {
        const api = new SallaAPI(merchantId, token);
        return api.verifyToken();
    }
};