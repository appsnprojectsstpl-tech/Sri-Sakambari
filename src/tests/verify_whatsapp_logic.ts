
import { performance } from 'perf_hooks';

// Mock Implementation of the Logic
class MockAdminView {
    // State
    activeTab = 'products';
    cachedWhatsappProducts: any[] | null = null;
    whatsappMessage = '';
    renderCount = 0;
    fetchCount = 0;

    // Callbacks
    setCachedWhatsappProducts(val: any) {
        this.cachedWhatsappProducts = val;
        // Schedule render
        this.scheduleRender();
    }

    setWhatsappMessage(val: string) {
        if (this.whatsappMessage === val) return; // React optimization
        this.whatsappMessage = val;
        this.scheduleRender();
    }

    renderPending = false;
    scheduleRender() {
        if (this.renderPending) return;
        this.renderPending = true;
        setImmediate(() => {
            this.renderPending = false;
            this.render();
        });
    }

    render() {
        this.renderCount++;
        this.useEffect();
    }

    async getDocs() {
        this.fetchCount++;
        await new Promise(r => setTimeout(r, 10)); // Latency
        return {
            docs: Array.from({ length: 50 }, (_, i) => ({
                id: `p${i}`,
                data: () => ({ name: `Product ${i}`, pricePerUnit: 10, unit: 'kg', isActive: true })
            }))
        };
    }

    async useEffect() {
        if (this.activeTab === 'whatsapp') {
            // Logic from component
            let activeProducts = this.cachedWhatsappProducts;

            if (!activeProducts) {
                // console.log("Fetching...");
                const snapshot = await this.getDocs();
                activeProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.setCachedWhatsappProducts(activeProducts);
                return;
            }

            const productList = activeProducts.length;
            this.setWhatsappMessage(`Generated with ${productList} products`);
        }
    }

    // Simulate interactions
    async switchToWhatsapp() {
        console.log("--- Switch to Whatsapp ---");
        this.activeTab = 'whatsapp';
        this.render();
        await new Promise(r => setTimeout(r, 100)); // Wait for effects
    }

    async switchToProducts() {
        console.log("--- Switch to Products ---");
        this.activeTab = 'products';
        this.render();
        await new Promise(r => setTimeout(r, 50));
    }

    invalidateCache() {
        console.log("--- Invalidate Cache ---");
        this.setCachedWhatsappProducts(null);
        // Wait for render
        return new Promise(r => setTimeout(r, 50));
    }
}

async function runTest() {
    console.log("Starting Verification...");
    const component = new MockAdminView();

    // 1. First Visit
    await component.switchToWhatsapp();
    console.log(`Render Count: ${component.renderCount}, Fetch Count: ${component.fetchCount}`);

    // Expected:
    // Render 1: Tab Change -> calls useEffect -> fetch -> setCached -> Render 2
    // Render 2: calls useEffect -> cache exists -> setMsg -> Render 3
    // Total Renders: 3

    // 2. Switch Away and Back
    await component.switchToProducts();
    await component.switchToWhatsapp();
    console.log(`Render Count: ${component.renderCount}, Fetch Count: ${component.fetchCount}`);

    // Expected:
    // Render 4: Tab Change (Products)
    // Render 5: Tab Change (Whatsapp) -> calls useEffect -> cache exists -> setMsg -> Render 6? (Msg same, so maybe no re-render if optimized)
    // Fetches should NOT increase.

    if (component.fetchCount === 1) {
        console.log("PASS: Cache prevented redundant fetch.");
    } else {
        console.log("FAIL: Redundant fetch occurred.");
    }

    // 3. Invalidate
    await component.invalidateCache();
    await component.switchToWhatsapp();

    console.log(`Final Fetch Count: ${component.fetchCount}`);
    if (component.fetchCount === 2) {
        console.log("PASS: Invalidation triggered fetch.");
    } else {
        console.log(`FAIL: Expected 2 fetches, got ${component.fetchCount}`);
    }
}

runTest();
