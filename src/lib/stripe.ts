import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // @ts-ignore
  apiVersion: '2023-10-16', // Use the latest compatible version
  appInfo: {
    name: 'Apex Machine',
    version: '1.0.0',
  },
});
