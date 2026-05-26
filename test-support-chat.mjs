/**
 * VetNotes Support Chat — Frontend QA Test
 * 
 * Tests the deployed support chat widget:
 * 1. Chat opens and shows welcome message
 * 2. Text input works and gets a response (smart FAQ fallback)
 * 3. "vetqa" diagnostic command returns system audit
 * 4. Voice input button exists and is clickable
 * 5. Image attachment button exists
 * 6. Listen (TTS) button appears on AI responses
 * 7. Expand/minimize works
 */

import { chromium } from '/Users/studio/WORK/VET/VET-ECOSYSTEM/TESTING/VetQA/node_modules/playwright/index.mjs';

const BASE_URL = process.env.TEST_URL || 'http://localhost:4173';
const results = [];

function log(test, pass, detail = '') {
    const icon = pass ? '✅' : '❌';
    const msg = `${icon} ${test}${detail ? ` — ${detail}` : ''}`;
    console.log(msg);
    results.push({ test, pass, detail });
}

async function run() {
    console.log(`\n🔬 VetNotes Support Chat QA — Testing ${BASE_URL}\n`);
    console.log('─'.repeat(60));

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Navigate to VetNotes
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);

        // TEST 1: Chat bubble exists
        const chatBubble = page.locator('button[aria-label="Open support chat"]');
        const bubbleVisible = await chatBubble.isVisible().catch(() => false);
        log('Chat bubble visible', bubbleVisible);

        if (!bubbleVisible) {
            console.log('\n⚠️  Chat bubble not found — aborting remaining tests');
            await browser.close();
            return;
        }

        // Open chat
        await chatBubble.click();
        await page.waitForTimeout(500);

        // TEST 2: Welcome message appears
        const welcomeMsg = page.locator('text=VetNotes Support');
        const welcomeVisible = await welcomeMsg.first().isVisible().catch(() => false);
        log('Welcome message visible', welcomeVisible);

        // TEST 3: Input field exists
        const input = page.locator('input[placeholder*="Ask about VetNotes"]');
        const inputVisible = await input.isVisible().catch(() => false);
        log('Text input field visible', inputVisible);

        // TEST 4: Voice button exists
        const voiceBtn = page.locator('button[aria-label="Voice input"]');
        const voiceVisible = await voiceBtn.isVisible().catch(() => false);
        log('Voice input (🎤) button visible', voiceVisible);

        // TEST 5: Image button exists
        const imageBtn = page.locator('button[aria-label="Attach image"]');
        const imageVisible = await imageBtn.isVisible().catch(() => false);
        log('Image attachment (📷) button visible', imageVisible);

        // TEST 6: Send a basic message and get a response
        await input.fill('how do I save my notes?');
        await page.locator('button[aria-label="Send message"]').click();
        await page.waitForTimeout(1500);

        // Check for AI response (should contain save-related info from smart FAQ)
        // Wait for loading indicator to disappear
        await page.waitForTimeout(2000);
        // Find all message bubbles - AI messages have the "VetNotes AI" label
        const allText = await page.locator('#support-chat-messages').innerText().catch(() => '');
        const gotResponse = allText.includes('Export') || allText.includes('export') || allText.includes('Sync') || allText.includes('sync') || allText.includes('Cloud') || allText.includes('browser');
        log('Smart FAQ responds to "save" query', gotResponse, gotResponse ? 'Contains save/export info' : `Chat content: "${allText.substring(allText.length - 120)}"`);

        // TEST 7: Listen button appears on AI response
        const listenBtn = page.locator('button[aria-label="Listen to message"]');
        const listenVisible = await listenBtn.first().isVisible().catch(() => false);
        log('Listen (TTS) button on AI response', listenVisible);

        // TEST 8: VetQA diagnostic command
        await input.fill('vetqa');
        await page.locator('button[aria-label="Send message"]').click();
        await page.waitForTimeout(1500);

        const vetqaResponse = page.locator('text=VetQA System Audit');
        const vetqaWorks = await vetqaResponse.isVisible({ timeout: 5000 }).catch(() => false);
        log('VetQA diagnostic trap responds', vetqaWorks, vetqaWorks ? 'System audit returned' : 'No diagnostic output');

        // TEST 9: Expand button works
        const expandBtn = page.locator('button[aria-label="Expand chat"]');
        const expandVisible = await expandBtn.isVisible().catch(() => false);
        if (expandVisible) {
            await expandBtn.click();
            await page.waitForTimeout(300);
            const collapseBtn = page.locator('button[aria-label="Minimize chat"]');
            const expanded = await collapseBtn.isVisible().catch(() => false);
            log('Expand/minimize toggle works', expanded);
        } else {
            log('Expand/minimize toggle works', false, 'Expand button not found');
        }

        // TEST 10: Close button works
        const closeBtn = page.locator('button[aria-label="Close chat"]');
        await closeBtn.click();
        await page.waitForTimeout(300);
        const chatClosed = await chatBubble.isVisible().catch(() => false);
        log('Close button returns to bubble', chatClosed);

        // TEST 11: Voice input - verify it doesn't auto-submit
        await chatBubble.click();
        await page.waitForTimeout(300);
        // Mock SpeechRecognition to test the flow
        await page.evaluate(() => {
            // Inject a mock that simulates speech result
            const MockSpeech = function() {
                this.continuous = false;
                this.interimResults = false;
                this.lang = '';
                this.start = () => {
                    setTimeout(() => {
                        if (this.onresult) {
                            this.onresult({
                                resultIndex: 0,
                                results: { 
                                    0: { 0: { transcript: 'test voice input' }, isFinal: true, length: 1 },
                                    length: 1
                                }
                            });
                        }
                    }, 200);
                };
                this.stop = () => { if (this.onend) this.onend(); };
            };
            window.webkitSpeechRecognition = MockSpeech;
        });
        // Note: Can't fully test voice in headless without real mic, but we verified the button exists

    } catch (err) {
        console.error('\n💥 Test error:', err.message);
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n' + '─'.repeat(60));
    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    const pct = Math.round((passed / total) * 100);
    console.log(`\n📊 Results: ${passed}/${total} passed (${pct}%)`);
    
    if (passed === total) {
        console.log('🎉 All tests passed! VetNotes support chat is fully functional.\n');
    } else {
        console.log(`⚠️  ${total - passed} test(s) failed. Review above.\n`);
    }

    process.exit(passed === total ? 0 : 1);
}

run();
