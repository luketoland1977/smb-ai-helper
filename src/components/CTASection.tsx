import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="bg-gradient-primary">
      <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to Transform Your Customer Service?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-white/90">
            Join hundreds of SMBs that have reduced their customer service costs while improving customer satisfaction.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button variant="accent" size="lg" className="text-lg px-8 py-4">
              Start Your Free Consultation
            </Button>
            <Button variant="outline" size="lg" className="text-white border-white hover:bg-white/10 text-lg px-8 py-4">
              Learn More
            </Button>
          </div>
          <p className="mt-6 text-sm text-white/70">
            No setup fees • 30-day money-back guarantee • Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;