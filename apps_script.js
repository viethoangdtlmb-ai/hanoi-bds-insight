// Google Apps Script — Webhook cho BDS Insight
// Deploy: Publish → Deploy as web app → Anyone can access

// ID của Google Sheet (thay bằng ID thực)
var SHEET_ID = 'YOUR_SHEET_ID';

function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
        var data = JSON.parse(e.postData.contents);
        var action = data.action;
        var ss = SpreadsheetApp.openById(SHEET_ID);

        if (action === 'register') {
            return registerUser(ss, data);
        } else if (action === 'login') {
            return logLogin(ss, data);
        } else if (action === 'track') {
            return trackActivity(ss, data);
        } else if (action === 'check') {
            return checkUser(ss, data);
        }

        return jsonResponse({ status: 'error', message: 'Unknown action' });
    } catch (err) {
        return jsonResponse({ status: 'error', message: err.toString() });
    } finally {
        lock.releaseLock();
    }
}

function registerUser(ss, data) {
    var sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');

    // Check header
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Email', 'Tên', 'SĐT', 'Ngày đăng ký', 'Lần login cuối', 'Số lần login']);
    }

    // Check if user exists
    var emails = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues().flat();
    var rowIndex = emails.indexOf(data.email);

    if (rowIndex >= 0) {
        // Update phone if missing
        var row = rowIndex + 2;
        if (!sheet.getRange(row, 3).getValue() && data.phone) {
            sheet.getRange(row, 3).setValue(data.phone);
        }
        sheet.getRange(row, 5).setValue(new Date());
        var count = sheet.getRange(row, 6).getValue() || 0;
        sheet.getRange(row, 6).setValue(count + 1);
        return jsonResponse({ status: 'ok', isNew: false });
    }

    // New user
    sheet.appendRow([
        data.email,
        data.name || '',
        data.phone || '',
        new Date(),
        new Date(),
        1
    ]);

    return jsonResponse({ status: 'ok', isNew: true });
}

function logLogin(ss, data) {
    var sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
    var emails = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues().flat();
    var rowIndex = emails.indexOf(data.email);

    if (rowIndex >= 0) {
        var row = rowIndex + 2;
        sheet.getRange(row, 5).setValue(new Date());
        var count = sheet.getRange(row, 6).getValue() || 0;
        sheet.getRange(row, 6).setValue(count + 1);
    }

    // Log activity
    trackActivity(ss, { email: data.email, type: 'login', detail: '' });

    return jsonResponse({ status: 'ok' });
}

function checkUser(ss, data) {
    var sheet = ss.getSheetByName('Users');
    if (!sheet) return jsonResponse({ status: 'ok', hasPhone: false, registered: false });

    var emails = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues().flat();
    var rowIndex = emails.indexOf(data.email);

    if (rowIndex >= 0) {
        var phone = sheet.getRange(rowIndex + 2, 3).getValue();
        return jsonResponse({ status: 'ok', registered: true, hasPhone: !!phone });
    }

    return jsonResponse({ status: 'ok', registered: false, hasPhone: false });
}

function trackActivity(ss, data) {
    var sheet = ss.getSheetByName('Activity') || ss.insertSheet('Activity');

    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Thời gian', 'Email', 'Hành vi', 'Chi tiết']);
    }

    sheet.appendRow([
        new Date(),
        data.email || '',
        data.type || '',
        data.detail || ''
    ]);

    // Keep only last 5000 rows
    if (sheet.getLastRow() > 5000) {
        sheet.deleteRows(2, sheet.getLastRow() - 5000);
    }

    return jsonResponse({ status: 'ok' });
}

function jsonResponse(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
    return jsonResponse({ status: 'ok', message: 'BDS Insight API' });
}
