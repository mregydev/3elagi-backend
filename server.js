const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const TARGET_URL = 'http://eservices.edaegypt.gov.eg/EDASearch/SearchRegDrugs.aspx';

// We use an Axios instance with a cookie jar enabled to persist session cookies
const client = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    },
    // This ensures cookies sent by the server (ASP.NET_SessionId) are maintained
    withCredentials: true 
});

async function runScraper() {
    try {
        console.log("Step 1: Fetching initial page to grab ASP.NET ViewState tokens...");
        const firstResponse = await client.get(TARGET_URL);
        
        // Grab the cookie headers if present to keep the session alive
        const sessionCookie = firstResponse.headers['set-cookie'];
        const requestHeaders = {};
        if (sessionCookie) {
            requestHeaders['Cookie'] = sessionCookie.map(c => c.split(';')[0]).join('; ');
        }

        const $initial = cheerio.load(firstResponse.data);

        // Extract the hidden ASP.NET form variables
        const viewState = $initial('#__VIEWSTATE').val() || '';
        const viewStateGenerator = $initial('#__VIEWSTATEGENERATOR').val() || '';
        const eventValidation = $initial('#__EVENTVALIDATION').val() || '';

        console.log("Tokens retrieved successfully!");

        // Step 2: Build the search payload
        // On this specific page:
        // - "ctl00$ContentPlaceHolder1$txt_Generic_Name" is the input box for the active ingredient.
        // - "ctl00$ContentPlaceHolder1$btn_Search" is the search button.
        const searchPayload = {
            '__VIEWSTATE': viewState,
            '__VIEWSTATEGENERATOR': viewStateGenerator,
            '__EVENTVALIDATION': eventValidation,
            // Search term (e.g., 'Amoxicillin'). Leave empty '' to pull default list if allowed by portal
            'ctl00$ContentPlaceHolder1$txt_Generic_Name': 'Amoxicillin', 
            'ctl00$ContentPlaceHolder1$btn_Search': 'Search'
        };

        // Convert the payload to application/x-www-form-urlencoded format
        const formParams = new URLSearchParams(searchPayload).toString();

        console.log("Step 2: Submitting POST request with search parameters...");
        const postResponse = await client.post(TARGET_URL, formParams, {
            headers: {
                ...requestHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': TARGET_URL
            }
        });

        console.log("Step 3: Parsing the search results...");
        const $results = cheerio.load(postResponse.data);

        // Select the ASP.NET GridView table
        const tableSelector = '#ContentPlaceHolder1_ui_GVDrugsData';
        const table = $results(tableSelector);

        if (!table.length) {
            console.error("Could not find the results table. Check if your search term yielded results or if the page layout updated.");
            // Write HTML to file for local debugging
            fs.writeFileSync('error_response.html', postResponse.data);
            console.log("Saved raw HTML response to 'error_response.html' for troubleshooting.");
            return;
        }

        // 1. Parse table headers
        const headers = [];
        table.find('tr').first().find('th, td').each((_, el) => {
            const headerText = $results(el).text().trim();
            if (headerText) headers.push(headerText);
        });

        console.log("Found Columns:", headers);

        // 2. Parse table data rows
        const medications = [];
        // Loop through rows (skipping the first header row)
        table.find('tr').slice(1).each((_, row) => {
            const cells = $results(row).find('td');
            if (cells.length > 0) {
                const rowData = {};
                cells.each((index, cell) => {
                    const key = headers[index] || `column_${index}`;
                    rowData[key] = $results(cell).text().trim().replace(/\s+/g, ' ');
                });
                
                // Skip pagination rows or empty rows
                if (Object.keys(rowData).length > 0 && rowData[headers[0]] !== undefined) {
                    medications.push(rowData);
                }
            }
        });

        // Step 4: Save data to JSON
        const outputFilename = 'eda_medications.json';
        fs.writeFileSync(outputFilename, JSON.stringify(medications, null, 2), 'utf-8');
        
        console.log("-----------------------------------------");
        console.log(`Success! Extracted ${medications.length} medications.`);
        console.log(`Results saved to: ./${outputFilename}`);
        console.log("-----------------------------------------");

    } catch (error) {
        console.error("An error occurred while scraping:", error.message);
        if (error.response) {
            console.error("Server responded with status code:", error.response.status);
        }
    }
}

runScraper();