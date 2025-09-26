import { Button } from "@/components/ui/button";
import heroImage from "@/assets/friendly-service-robots.jpg";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="absolute inset-0 bg-grid-white/10" />
      <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl animate-fade-in">
            AI Customer Service Agents for 
            <span className="text-accent"> SMBs</span>
            <br />
            Save up to <span className="text-accent">70%</span> on Customer Service Costs
          </h1>
          <p className="mt-6 text-lg leading-8 text-white/90 animate-fade-in">
            Embed intelligent AI agents into your existing CRM, chat, and email systems. 
            Deploy as widgets or subdomains. Reduce costs while improving customer satisfaction.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6 animate-fade-in">
            <Button variant="hero" size="lg" className="text-lg px-8 py-4">
              <a href="/auth">Get Started Today</a>
            </Button>
            <Button variant="outline" size="lg" className="text-white border-white hover:bg-white/10 text-lg px-8 py-4">
              <a href="/dashboard">View Dashboard</a>
            </Button>
          </div>
        </div>
        <div className="mt-16 flow-root sm:mt-24">
          <div className="relative rounded-xl bg-white/5 p-2 ring-1 ring-white/10 lg:rounded-2xl lg:p-4">
            <img
              src={heroImage}
              alt="AI Customer Service Dashboard"
              className="rounded-md shadow-2xl ring-1 ring-white/10"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;