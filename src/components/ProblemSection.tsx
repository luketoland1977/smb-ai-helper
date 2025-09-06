import { AlertTriangle, DollarSign, Clock, Users } from "lucide-react";

const ProblemSection = () => {
  const problems = [
    {
      icon: DollarSign,
      title: "High Labor Costs",
      description: "Customer service staff salaries, benefits, and training costs are eating into your profits."
    },
    {
      icon: Clock,
      title: "24/7 Coverage Challenges",
      description: "Providing round-the-clock support with human agents is expensive and difficult to manage."
    },
    {
      icon: Users,
      title: "Scaling Difficulties",
      description: "Growing your business means hiring more support staff, increasing overhead exponentially."
    },
    {
      icon: AlertTriangle,
      title: "Inconsistent Service",
      description: "Human agents have varying skill levels and may provide inconsistent customer experiences."
    }
  ];

  return (
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Customer Service Challenges for SMBs
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Small to medium businesses face unique challenges when it comes to providing quality customer service while managing costs.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
            {problems.map((problem) => (
              <div key={problem.title} className="flex flex-col bg-gradient-card p-8 rounded-xl shadow-card hover:shadow-elegant transition-all duration-300">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground">
                  <problem.icon className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                  {problem.title}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                  <p className="flex-auto">{problem.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;