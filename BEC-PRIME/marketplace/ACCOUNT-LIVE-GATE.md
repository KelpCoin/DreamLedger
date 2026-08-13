# ACCOUNT LIVE GATE

Purpose: keep the B2B marketplace blocked from buyer use until identity is actually available.

Required live path:

GET /register.html
POST /api/dreamiez/account/create
POST /api/dreamiez/account/login
GET /dreamiez

The runtime already imports the Dreamiez route module from the commerce server. The gate is therefore deployment verification, not another frontend build.

PASS requires account creation and login to return success from the deployed service. A GitHub commit is not evidence of live account creation.

PC requirement: none for the cloud deployment.
