import { CheckCircle, Bot, Shield, Zap } from "lucide-react";

const SolutionSection = () => {
  const benefits = [
    {
      icon: Bot,
      title: "AI-Powered Automation",
      description: "Advanced AI agents handle 90% of customer inquiries instantly, reducing workload on your team."
    },
    {
      icon: Zap,
      title: "Instant Setup & Optimization",
      description: "We build, deploy, and continuously optimize your AI agents for maximum effectiveness."
    },
    {
      icon: Shield,
      title: "Compliant & Secure",
      description: "Perfect for non-financial, non-legal, non-medical businesses with robust security measures."
    },
    {
      icon: CheckCircle,
      title: "Proven ROI",
      description: "Most clients see 60-80% reduction in customer service costs within the first 3 months."
    }
  ];

  return (
    <section className="py-24 bg-muted/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            AI Customer Service That Actually Works
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            We specialize in creating, maintaining, and optimizing AI customer service agents specifically for SMBs.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground">
                  <benefit.icon className="h-5 w-5 flex-none text-accent" aria-hidden="true" />
                  {benefit.title}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                  <p className="flex-auto">{benefit.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;