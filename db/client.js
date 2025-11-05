"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const globalForPrisma = globalThis;
const isDevelopment = !globalThis.process?.env?.NODE_ENV || globalThis.process.env.NODE_ENV === 'development';
exports.prisma = globalForPrisma.prisma ?? new client_1.PrismaClient({
    log: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
});
if (isDevelopment) {
    globalForPrisma.prisma = exports.prisma;
}
//# sourceMappingURL=client.js.map