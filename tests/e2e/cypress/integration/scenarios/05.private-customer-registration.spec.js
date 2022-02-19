/// <reference types="Cypress" />

describe('Product creation via UI and private customer registration', () => {
    beforeEach(() => {
        cy.loginViaApi();
    });

    it('@package: should order as private customer', () => {
        cy.authenticate().then((result) => {
            const requestConfig = {
                headers: {
                    Authorization: `Bearer ${result.access}`
                },
                method: 'POST',
                url: `api/_action/system-config/batch`,
                body: {
                    null: {
                        'core.cart.showCustomerComment': true,
                        'core.cart.showDeliveryTime': true
                    }
                }
            };
            return cy.request(requestConfig);
        });
        cy.intercept({
            url: `**/${Cypress.env('apiPath')}/_action/sync`,
            method: 'POST'
        }).as('createProduct');
        cy.intercept({
            url: `**/${Cypress.env('apiPath')}/_action/calculate-price`,
            method: 'POST'
        }).as('calculatePrice');
        cy.intercept({
            url: `/account/register`,
            method: 'POST'
        }).as('registerCustomer');

        // Saleschannel initial settings
        cy.visit(`${Cypress.env('admin')}#/sw/settings/listing/index`);
        cy.url().should('include', 'settings/listing/index');
        cy.setSalesChannel('E2E install test');
        cy.visit(`${Cypress.env('admin')}#/sw/settings/shipping/index`);
        cy.url().should('include', 'settings/shipping/index');
        cy.setShippingMethod('Standard', '5', '4');
        cy.visit(`${Cypress.env('admin')}#/sw/settings/payment/index`);
        cy.url().should('include', 'settings/payment/index');
        cy.setPaymentMethod('Cash on delivery');
        cy.visit(`${Cypress.env('admin')}#/sw/dashboard/index`);
        cy.url().should('include', 'dashboard/index');
        cy.goToSalesChannelDetail('E2E install test')
            .selectPaymentMethodForSalesChannel('Cash on delivery')
            .selectShippingMethodForSalesChannel('Standard');

        // Create product via UI
        cy.visit(`${Cypress.env('admin')}#/sw/product/index`);
        cy.url().should('include', 'product/index');
        cy.get('.sw-button.sw-button--primary').click();
        cy.get('#sw-field--product-name').typeAndCheck('Product-5');
        cy.get('#manufacturerId').typeSingleSelectAndCheck('shopware AG', '#manufacturerId');
        cy.get('.sw-text-editor__content-editor').type('Test');
        cy.get('.sw-product-basic-form__promotion-switch [type]').check();
        cy.get('#sw-field--product-taxId').select('Standaard tarief');
        cy.get('.sw-list-price-field__price .sw-price-field__gross [type]').typeAndCheck('14.99');
        cy.get('.sw-list-price-field__price .sw-price-field__net [type]').focus().blur();
        cy.get('.sw-list-price-field__price .sw-price-field__net [type]').should('have.value', '12.596638655462');
        cy.wait('@calculatePrice').its('response.statusCode').should('equal', 200);
        cy.get('#sw-field--product-stock').clearTypeAndCheck('100');
        cy.get('#deliveryTimeId').typeSingleSelectAndCheck('1-3 days', '#deliveryTimeId');
        cy.get('#sw-field--product-restock-time').typeAndCheck('10');
        cy.get('.sw-product-deliverability__min-purchase [type]').typeAndCheck('1');
        cy.get('.sw-product-deliverability__purchase-step [type]').typeAndCheck('1')
        cy.get('.sw-product-deliverability__max-purchase [type]').typeAndCheck('10')
        cy.get('.sw-product-detail__select-visibility').scrollIntoView();
        cy.contains('.sw-product-detail__select-visibility', 'E2E install test');
        cy.get('.sw-product-category-form [type="checkbox"]').should('be.checked');
        cy.get('.sw-button-process__content').click();
        cy.wait('@createProduct').its('response.statusCode').should('equal', 200);
        cy.get('.sw-loader').should('not.exist');
        cy.get('.sw-button-process__content').contains('Opslaan');

        // Check from product in admin
        cy.get('a.smart-bar__back-btn').click();
        cy.get('.sw-search-bar__input').typeAndCheckSearchField('Product-5');
        cy.get(`.sw-data-grid__row--0 .sw-data-grid__cell--name`).contains('Product-5');
        cy.get('.sw-skeleton__listing').should('not.exist');

        // Register as private customer
        cy.visit('/account/login');
        cy.url().should('include', '/account/login');
        cy.get('#personalSalutation').select('Mr.');
        cy.get('#personalFirstName').typeAndCheckStorefront('Test');
        cy.get('#personalLastName').typeAndCheckStorefront('Tester');
        cy.get('#personalMail').typeAndCheckStorefront('test5@tester.com');
        cy.get('#personalPassword').typeAndCheckStorefront('shopware');
        cy.get('#billingAddressAddressStreet').typeAndCheckStorefront('Test street');
        cy.get('#billingAddressAddressZipcode').typeAndCheckStorefront('12345');
        cy.get('#billingAddressAddressCity').typeAndCheckStorefront('Test city');
        cy.get('#billingAddressAddressCountry').select('Netherlands');
        cy.get('.btn.btn-lg.btn-primary').click();
        cy.wait('@registerCustomer').its('response.statusCode').should('equal', 302);

        // Make an order
        cy.get('.header-search-input').should('be.visible').type('Product-5');
        cy.contains('.search-suggest-product-name', 'Product-5').click();
        cy.get('.product-detail-buy .btn-buy').click();
        cy.get('.offcanvas.is-open').should('be.visible');
        cy.get('.cart-item-label').contains('Product-5');
        cy.get('.offcanvas-cart-actions [href="/checkout/cart"]').click();
        cy.get('.cart-item-details-container [title]').contains('Product-5');
        cy.get('.cart-item-total-price.col-12.col-md-2.col-sm-4').contains('14,99');
        cy.get('.cart-item-delivery-date').should('be.visible');
        cy.get('.col-5.checkout-aside-summary-total').contains('19,99');
        cy.get('a[title="Proceed to checkout"]').click();
        cy.get('.confirm-address').contains('Test Tester');
        cy.get('.cart-item-label').contains('Product-5');
        cy.get('.cart-item-total-price').scrollIntoView();
        cy.get('.cart-item-total-price').contains('14,99');
        cy.get('.col-5.checkout-aside-summary-total').contains('19,99');
        cy.get('.cart-item-delivery-date').should('be.visible');
        cy.get('.checkout-customer-comment-control').should('be.visible');
        cy.get('.confirm-tos .card-title').contains('Terms and conditions and cancellation policy');
        cy.get('.confirm-tos .custom-checkbox label').scrollIntoView();
        cy.get('.confirm-tos .custom-checkbox label').click(1, 1);
        cy.get('#confirmFormSubmit').scrollIntoView();
        cy.get('#confirmFormSubmit').click();
        cy.get('.finish-header').contains(`Thank you for your order with E2E install test!`);

        // Verify order
        cy.visit('/account/order');
        cy.get('.order-item-header').contains('10000');
        cy.contains('View').click();
        cy.get('.order-item-total-value').contains('14,99');
        cy.get('.order-item-detail-summary').contains('19,99');
    });
});
