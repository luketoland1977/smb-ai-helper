import { Bot } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8">
            <div className="flex items-center gap-2">
              <Bot className="h-8 w-8 text-accent" />
              <span className="text-xl font-bold">AI Service Pro</span>
            </div>
            <p className="text-sm leading-6 text-background/70">
              Transforming customer service for small to medium businesses with AI-powered agents that reduce costs and improve satisfaction.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-background">Solutions</h3>
                <ul role="list" className="mt-6 space-y-4">
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      AI Customer Agents
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      Chat Integration
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      Email Automation
                    </a>
                  </li>
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-background">Support</h3>
                <ul role="list" className="mt-6 space-y-4">
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      Documentation
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      Help Center
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      Contact Us
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-background">Company</h3>
                <ul role="list" className="mt-6 space-y-4">
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      About
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      Careers
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      Partners
                    </a>
                  </li>
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-background">Legal</h3>
                <ul role="list" className="mt-6 space-y-4">
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      Privacy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm leading-6 text-background/70 hover:text-background transition-colors">
                      Terms
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-16 border-t border-background/10 pt-8 sm:mt-20 lg:mt-24">
          <p className="text-xs leading-5 text-background/70">
            &copy; 2024 AI Service Pro. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;