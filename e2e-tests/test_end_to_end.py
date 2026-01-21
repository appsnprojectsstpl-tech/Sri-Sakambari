
import time
import pytest
from playwright.sync_api import sync_playwright

BASE_URL = "https://studio-1474537647-7252f.web.app"

@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()

@pytest.fixture
def page(browser):
    context = browser.new_context(
        viewport={"width": 1366, "height": 768},
        record_video_dir="videos/"
    )
    page = context.new_page()
    yield page
    page.close()
    context.close()

def test_01_site_loads(page):
    page.goto(BASE_URL, timeout=30000)
    assert page.url.startswith("https")

def test_02_page_title_exists(page):
    page.goto(BASE_URL)
    assert page.title() != ""

def test_03_no_console_errors(page):
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.goto(BASE_URL)
    page.wait_for_timeout(3000)
    assert len(errors) == 0

def test_04_navigation_links(page):
    page.goto(BASE_URL)
    links = page.locator("a")
    assert links.count() > 0

def test_05_clickable_elements(page):
    page.goto(BASE_URL)
    buttons = page.locator("button")
    if buttons.count() > 0:
        buttons.first.click(force=True)

def test_06_form_inputs(page):
    page.goto(BASE_URL)
    inputs = page.locator("input")
    if inputs.count() > 0:
        inputs.first.fill("test@example.com")
        assert inputs.first.input_value() != ""

def test_07_responsive_mobile(browser):
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    page.goto(BASE_URL)
    page.screenshot(path="screenshots/mobile.png", full_page=True)
    context.close()

def test_08_performance_basic(page):
    start = time.time()
    page.goto(BASE_URL)
    load_time = time.time() - start
    assert load_time < 8
