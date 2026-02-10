class ResponseHelper {
    /**
     * @param {boolean} success - Indicates if the request was successful
     * @param {string} message - Response message
     * @param {object} data - Response payload
     * @param {number} status - HTTP status code
     * @returns {object} - Standardized response object
     */
    static getResponse(success, message, data = {}, status = 200) {
        return {
            success,
            message,
            data,
            status
        };
    }
}

module.exports = ResponseHelper;
