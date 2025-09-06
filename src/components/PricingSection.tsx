import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const PricingSection = () => {
  const tiers = [
    {
      name: 'Starter',
      id: 'tier-starter',
      price: '$300',
      description: 'Perfect for small businesses getting started with AI customer service.',
      features: [
        'AI agent setup & training',
        'Basic knowledge base integration',
        'Email & chat support integration',
        'Monthly performance reports',
        'Standard response time optimization',
      ],
      featured: false,
    },
    {
      name: 'Professional',
      id: 'tier-professional',
      price: '$600',
      description: 'Ideal for growing businesses with moderate customer service volume.',
      features: [
        'Everything in Starter',
        'Advanced AI training & customization',
        'Multi-channel integration (email, chat, social)',
        'Real-time analytics dashboard',
        'Priority support & optimization',
        'Custom workflows & escalation rules',
      ],
      featured: true,
    },
    {
      name: 'Enterprise',
      id: 'tier-enterprise',
      price: '$1000',
      description: 'For established businesses requiring comprehensive AI customer service.',
      features: [
        'Everything in Professional',
        'Advanced AI personality customization',
        'Full CRM integration',
        'Advanced analytics & insights',
        'Dedicated account manager',
        'Custom API integrations',
        'White-label options available',
      ],
      featured: false,
    },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Choose the plan that fits your business size and customer service needs. No hidden fees, no setup costs.
          </p>
        </div>
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 xl:gap-x-12">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-3xl p-8 ring-1 ${
                tier.featured
                  ? 'bg-gradient-card ring-primary/20 shadow-elegant'
                  : 'bg-card ring-border shadow-card'
              } hover:shadow-elegant transition-all duration-300`}
            >
              <h3
                id={tier.id}
                className={`text-lg font-semibold leading-8 ${
                  tier.featured ? 'text-primary' : 'text-foreground'
                }`}
              >
                {tier.name}
              </h3>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{tier.description}</p>
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-bold tracking-tight text-foreground">{tier.price}</span>
                <span className="text-sm font-semibold leading-6 text-muted-foreground">/month</span>
              </p>
              <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-muted-foreground">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <Check className="h-6 w-5 flex-none text-accent" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={tier.featured ? 'hero' : 'default'}
                className="mt-8 w-full"
                size="lg"
              >
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;