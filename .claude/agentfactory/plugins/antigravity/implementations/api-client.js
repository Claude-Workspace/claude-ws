/**
 * Antigravity API Client
 * Provides methods for authentication, model listing, and image generation
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const ANTI_API_ENDPOINT = process.env.ANTI_API_ENDPOINT || 'https://api.antigravity.com';
const ANTI_TOKEN_ENCRYPTION_ALGORITHM = process.env.ANTI_ENCRYPTION_ALGORITHM || 'aes-256-gcm';
const ANTI_TOKEN_KEY_DERIVATION = process.env.ANTI_TOKEN_KEY_DERIVATION || 'pbkdf2';
const ANTI_TOKEN_ITERATIONS = parseInt(process.env.ANTI_TOKEN_ITERATIONS) || 100000;

/**
 * Initialize client with optional base URL
 */
class AntigravityClient {
  constructor(baseUrl = null) {
    this.baseUrl = baseUrl || ANTI_API_ENDPOINT;
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Set access token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Set refresh token
   */
  setRefreshToken(token) {
    this.refreshToken = token;
  }

  /**
   * Set token expiration time
   */
  setTokenExpiresAt(expiresAt) {
    this.tokenExpiresAt = expiresAt;
  }

  /**
   * Check if session is valid
   */
  isAuthenticated() {
    return this.token && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt;
  }

  /**
   * Ensure session is valid, refresh if needed
   */
  async ensureAuth() {
    if (!this.isAuthenticated()) {
      await this.refreshSession();
    }
  }

  /**
   * Get axios instance with auth headers
   */
  getAuthHeaders() {
    if (!this.token) {
      return {};
    }
    return {
      'Authorization': `Bearer ${this.token}`
    };
  }

  /**
   * Make authenticated API request
   */
  async apiRequest(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders()
    };

    try {
      const response = await axios({
        method,
        url,
        headers,
        data,
        timeout: 30000 // 30 second timeout
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw {
          code: error.response.data.code || 'API_ERROR',
          message: error.response.data.message || 'API request failed',
          status: error.response.status
        };
      }
      throw {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network request failed'
      };
    }
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    const response = await this.apiRequest('POST', '/api/v1/auth/token', {
      email,
      password,
      grant_type: 'password'
    });

    this.setToken(response.token);
    this.setRefreshToken(response.refreshToken);
    this.setTokenExpiresAt(Date.now() + (response.expiresIn || 24 * 60 * 60 * 1000));

    return {
      success: true,
      user: response.user,
      token: response.token,
      refreshToken: response.refreshToken,
      expiresAt: this.tokenExpiresAt
    };
  }

  /**
   * Login with API key
   */
  async loginWithApiKey(apiKey) {
    const response = await this.apiRequest('POST', '/api/v1/auth/verify', {
      apiKey
    });

    return {
      success: true,
      apiKey: apiKey
    };
  }

  /**
   * Refresh session
   */
  async refreshSession() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.apiRequest('POST', '/api/v1/auth/refresh', {
      refreshToken: this.refreshToken
    });

    this.setToken(response.token);
    this.setTokenExpiresAt(Date.now() + (response.expiresIn || 24 * 60 * 60 * 1000));

    return {
      success: true,
      token: response.token,
      expiresAt: this.tokenExpiresAt
    };
  }

  /**
   * Logout
   */
  async logout() {
    await this.apiRequest('POST', '/api/v1/auth/revoke');

    this.setToken(null);
    this.setRefreshToken(null);
    this.setTokenExpiresAt(null);

    return {
      success: true
    };
  }

  /**
   * List all available models
   */
  async listModels(options = {}) {
    await this.ensureAuth();

    const response = await this.apiRequest('GET', '/api/v1/models');

    return {
      success: true,
      claude: response.claude || [],
      image: response.image || []
    };
  }

  /**
   * Get specific model details
   */
  async getModel(modelId) {
    await this.ensureAuth();

    const response = await this.apiRequest('GET', `/api/v1/models/${modelId}`);

    return {
      success: true,
      model: response
    };
  }

  /**
   * Generate image
   */
  async generateImage(options) {
    await this.ensureAuth();

    const {
      model = 'flux-v1-pro',
      prompt = '',
      negativePrompt = null,
      width = 1024,
      height = 1024,
      steps = 30,
      cfg = 7.5,
      seed = null,
      style = null,
      numImages = 1
    } = options;

    const response = await this.apiRequest('POST', '/api/v1/images/generate', {
      model,
      prompt,
      negative_prompt: negativePrompt,
      width,
      height,
      steps,
      cfg_scale: cfg,
      seed,
      style,
      num_images: numImages
    });

    return {
      success: true,
      id: response.id,
      status: response.status,
      images: response.images || [],
      seed: response.seed,
      cost: response.cost,
      duration: response.duration
    };
  }

  /**
   * Get generation status
   */
  async getGenerationStatus(generationId) {
    await this.ensureAuth();

    const response = await this.apiRequest('GET', `/api/v1/images/${generationId}`);

    return {
      success: true,
      id: response.id,
      status: response.status,
      progress: response.progress || 0,
      images: response.images || [],
      error: response.error,
      cost: response.cost,
      duration: response.duration
    };
  }

  /**
   * Download generated image
   */
  async downloadImage(generationId, imageId, outputPath) {
    await this.ensureAuth();

    const response = await this.apiRequest('GET', `/api/v1/images/${generationId}/files/${imageId}`, null, {
      responseType: 'arraybuffer'
    });

    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(outputPath, Buffer.from(response.data));

    return {
      success: true,
      outputPath
    };
  }
}

module.exports = { AntigravityClient };
