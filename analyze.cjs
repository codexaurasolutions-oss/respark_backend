const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '../frontend/src');
const BACKEND_DIR = path.join(__dirname, 'src/modules');

// 1. Extract API calls from frontend
function getFrontendApiCalls(dir) {
    let calls = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            calls = calls.concat(getFrontendApiCalls(fullPath));
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Look for api.get("/path"), api.post(`/path/${id}`), etc.
            const regex = /(?:api|http|client)\.(?:get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                let route = match[1];
                // Frontend routes don't include /api/v1 prefix, but backend routes do or don't depending on how we extract them.
                calls.push({
                    file: fullPath.replace(FRONTEND_DIR, ''),
                    route: route
                });
            }
        }
    }
    return calls;
}

const frontendCalls = getFrontendApiCalls(FRONTEND_DIR);

function simplifyFrontendRoute(route) {
    return route
        .replace(/\$\{[^}]+\}/g, ':id') // replace ${id} with :id
        .split('?')[0]; // remove query params
}

const uniqueFrontendCalls = new Set(frontendCalls.map(c => simplifyFrontendRoute(c.route)));
console.log(`Found ${uniqueFrontendCalls.size} unique API routes called in frontend.`);

// 2. Extract registered routes from backend
function getBackendRoutes(dir) {
    let routes = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            routes = routes.concat(getBackendRoutes(fullPath));
        } else if (fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Look for router.get("...", router.post("..." etc
            const regex = /(?:router|ownerRouter|superAdminRouter|publicRouter|reportsRouter)\.(?:get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                let route = match[1];
                
                // Add prefix based on where the router is mounted
                let prefix = "";
                if (fullPath.includes('owner')) prefix = "/owner";
                if (fullPath.includes('superAdmin')) prefix = "/super-admin";
                if (fullPath.includes('public')) prefix = "/public";
                
                // Reports are mounted under /owner/reports usually, or just exported
                if (fullPath.includes('reports') && !route.startsWith('/reports')) {
                    // special handling for reports routes which might be mounted under /reports
                    route = "/reports" + (route === '/' ? '' : route);
                    prefix = "/owner"; 
                }

                routes.push({
                    file: fullPath.replace(BACKEND_DIR, ''),
                    route: prefix + route
                });
            }
        }
    }
    return routes;
}

const backendRoutes = getBackendRoutes(BACKEND_DIR);

function simplifyBackendRoute(route) {
    return route
        .replace(/\/:[^\/]+/g, '/:id') // replace /:someVar with /:id
        .replace(/\/+/g, '/'); // remove double slashes
}

const backendRouteSet = new Set(backendRoutes.map(r => simplifyBackendRoute(r.route)));
console.log(`Found ${backendRouteSet.size} registered routes in backend files.`);

console.log("\n--- Checking for missing backend routes ---");
let missingCount = 0;
for (const call of uniqueFrontendCalls) {
    // If the frontend route starts with http, it's external, skip it
    if (call.startsWith('http')) continue;
    
    // Some frontend routes might be missing leading slash, normalize
    const normalizedCall = call.startsWith('/') ? call : '/' + call;

    let found = false;
    for (const bRoute of backendRouteSet) {
        const normalizedBRoute = bRoute.startsWith('/') ? bRoute : '/' + bRoute;
        
        // Match exact or check if the patterns align
        if (normalizedCall === normalizedBRoute || normalizedBRoute.endsWith(normalizedCall)) {
            found = true;
            break;
        }
    }
    if (!found) {
        console.log(`POSSIBLE 404: Frontend calls '${normalizedCall}' but no matching backend route was found.`);
        missingCount++;
    }
}
console.log(`Analysis complete. Found ${missingCount} potential missing endpoints.`);
