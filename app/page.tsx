"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import Lottie from "lottie-react";
import aiLottie from "../public/ai-hero.json";
import { FaCogs, FaRocket, FaLock, FaMagic, FaChartLine, FaUserPlus, FaSignInAlt, FaPlus, FaPlay, FaEye, FaDownload, FaUpload } from "react-icons/fa";

// Animation Variants for Framer Motion
const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.6, -0.05, 0.01, 0.99] } },
};

const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const iconHover = {
  y: [0, -5, 0],
  transition: { duration: 0.5, repeat: Infinity, repeatType: "loop" }
};

// 3D Interactive Card Component
const InteractiveCard = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 20 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={className}
      variants={fadeInUp}
    >
      <div style={{
        transform: "translateZ(50px)",
        transformStyle: "preserve-3d",
      }} className="w-full h-full">
        {children}
      </div>
    </motion.div>
  );
};

export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Parallax effect
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 150]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-br from-flowbit-teal/10 via-white to-flowbit-blue/10 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500">
      {/* Theme Toggle */}
      {mounted && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1, type: "spring" }}
          className="fixed top-6 right-6 px-4 py-2 rounded-full glass-dark dark:glass text-lg font-semibold shadow-lg z-50"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </motion.button>
      )}

      {/* Hero Section with Lottie Animation */}
      <section className="w-full flex flex-col items-center justify-center py-24 px-4 text-center relative overflow-hidden">
        <motion.div
          style={{ y: y1 }}
          className="w-full flex flex-col items-center"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp} className="glass dark:glass-dark p-10 rounded-3xl shadow-2xl max-w-3xl mx-auto relative z-10">
            <motion.h1 variants={fadeInUp} className="text-5xl md:text-6xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-flowbit-blue to-flowbit-deep dark:from-flowbit-teal dark:to-flowbit-blue">Flowbit Orchestrator</motion.h1>
            <motion.p variants={fadeInUp} className="text-xl md:text-2xl mb-8 text-gray-700 dark:text-gray-200 font-medium">
              Build, automate, and orchestrate your AI workflows visually.<br />
              <span className="font-semibold">No code. No hassle. Just flow.</span>
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-col md:flex-row gap-4 justify-center">
              <Link href="/login" className="px-8 py-3 rounded-full bg-flowbit-blue text-white font-bold shadow-lg hover:bg-flowbit-deep transition">Login</Link>
              <Link href="/signup" className="px-8 py-3 rounded-full bg-flowbit-teal text-white font-bold shadow-lg hover:bg-flowbit-medium transition">Sign Up</Link>
            </motion.div>
          </motion.div>
          <motion.div variants={fadeInUp} className="w-full flex justify-center mt-[-80px] z-0">
            <Lottie animationData={aiLottie} loop={true} style={{ width: 400, height: 400 }} />
          </motion.div>
        </motion.div>
      </section>

      {/* Parallax/Scroll Animation Section */}
      <motion.section
        className="w-full flex flex-col items-center py-24 px-4"
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerContainer}
      >
        <motion.div style={{ y: y2, perspective: '1000px' }} className="glass dark:glass-dark p-8 rounded-2xl shadow-xl max-w-3xl mx-auto relative overflow-visible">
          <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-4">Visualize and Automate</motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-gray-600 dark:text-gray-300 mb-6">Drag, drop, and connect your workflow blocks. See your automations come to life with real-time feedback and analytics.</motion.p>
          {/* Parallax cards/icons */}
          <motion.div variants={staggerContainer} className="relative flex flex-wrap justify-center gap-8 min-h-[160px]" style={{ perspective: '800px' }}>
            <InteractiveCard className="bg-flowbit-teal/80 text-white rounded-xl p-6 shadow-lg flex flex-col items-center w-40">
              <motion.div whileHover={iconHover}><FaCogs size={36} /></motion.div>
              <span className="mt-2 font-semibold">No-Code Builder</span>
            </InteractiveCard>
            <InteractiveCard className="bg-flowbit-blue/80 text-white rounded-xl p-6 shadow-lg flex flex-col items-center w-40">
              <motion.div whileHover={iconHover}><FaRocket size={36} /></motion.div>
              <span className="mt-2 font-semibold">Fast Execution</span>
            </InteractiveCard>
            <InteractiveCard className="bg-flowbit-medium/80 text-white rounded-xl p-6 shadow-lg flex flex-col items-center w-40">
              <motion.div whileHover={iconHover}><FaLock size={36} /></motion.div>
              <span className="mt-2 font-semibold">Secure & Private</span>
            </InteractiveCard>
            <InteractiveCard className="bg-flowbit-deep/80 text-white rounded-xl p-6 shadow-lg flex flex-col items-center w-40">
              <motion.div whileHover={iconHover}><FaMagic size={36} /></motion.div>
              <span className="mt-2 font-semibold">AI-Powered</span>
            </InteractiveCard>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* How it Works Section */}
      <motion.section
        className="w-full flex flex-col items-center py-24 px-4 bg-flowbit-blue/5 dark:bg-flowbit-deep/10"
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerContainer}
      >
        <div className="max-w-5xl w-full mx-auto">
          <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-12 text-center">How it Works</motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8" style={{ perspective: '800px' }}>
            <InteractiveCard className="glass dark:glass-dark p-8 rounded-2xl shadow-xl flex flex-col items-center">
              <motion.span whileHover={{ rotate: 20 }} className="text-4xl mb-4">🧩</motion.span>
              <h3 className="font-bold text-xl mb-2">Design</h3>
              <p className="text-gray-600 dark:text-gray-300">Visually create workflows by dragging and connecting blocks. No code required.</p>
            </InteractiveCard>
            <InteractiveCard className="glass dark:glass-dark p-8 rounded-2xl shadow-xl flex flex-col items-center">
              <motion.span whileHover={{ rotate: 20 }} className="text-4xl mb-4">⚡</motion.span>
              <h3 className="font-bold text-xl mb-2">Automate</h3>
              <p className="text-gray-600 dark:text-gray-300">Automate repetitive tasks and integrate with your favorite tools and APIs.</p>
            </InteractiveCard>
            <InteractiveCard className="glass dark:glass-dark p-8 rounded-2xl shadow-xl flex flex-col items-center">
              <motion.span whileHover={{ rotate: 20 }} className="text-4xl mb-4">📊</motion.span>
              <h3 className="font-bold text-xl mb-2">Monitor</h3>
              <p className="text-gray-600 dark:text-gray-300">Track workflow runs, get real-time feedback, and optimize your processes.</p>
            </InteractiveCard>
          </div>
        </div>
      </motion.section>

      {/* How to Use Section */}
      <motion.section
        className="w-full flex flex-col items-center py-24 px-4"
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <div className="max-w-6xl w-full mx-auto" style={{ perspective: '800px' }}>
          <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-12 text-center">How to Use Flowbit Orchestrator</motion.h2>
          <motion.div variants={staggerContainer} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Getting Started */}
            <motion.div variants={fadeInUp} className="space-y-6">
              <h3 className="text-2xl font-bold text-flowbit-blue mb-6">Getting Started</h3>

              <InteractiveCard className="glass dark:glass-dark p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-flowbit-teal text-white rounded-full flex items-center justify-center font-bold mr-3">1</div>
                  <h4 className="font-semibold text-lg">Create Your Account</h4>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-3">Sign up for a free account to access the platform.</p>
                <div className="flex items-center text-sm text-flowbit-teal">
                  <FaUserPlus className="mr-2" />
                  <span>Click "Sign Up" in the top navigation</span>
                </div>
              </InteractiveCard>

              <InteractiveCard className="glass dark:glass-dark p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-flowbit-blue text-white rounded-full flex items-center justify-center font-bold mr-3">2</div>
                  <h4 className="font-semibold text-lg">Access Your Dashboard</h4>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-3">After login, you'll be taken to your main dashboard.</p>
                <div className="flex items-center text-sm text-flowbit-blue">
                  <FaSignInAlt className="mr-2" />
                  <span>View your workflows, executions, and analytics</span>
                </div>
              </InteractiveCard>

              <InteractiveCard className="glass dark:glass-dark p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-flowbit-medium text-white rounded-full flex items-center justify-center font-bold mr-3">3</div>
                  <h4 className="font-semibold text-lg">Create Your First Workflow</h4>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-3">Start building your automation workflow.</p>
                <div className="flex items-center text-sm text-flowbit-medium">
                  <FaPlus className="mr-2" />
                  <span>Click "Create Workflow" button</span>
                </div>
              </InteractiveCard>
            </motion.div>

            {/* Building Workflows */}
            <motion.div variants={fadeInUp} className="space-y-6">
              <h3 className="text-2xl font-bold text-flowbit-deep mb-6">Building Workflows</h3>

              <InteractiveCard className="glass dark:glass-dark p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-flowbit-deep text-white rounded-full flex items-center justify-center font-bold mr-3">4</div>
                  <h4 className="font-semibold text-lg">Design Your Flow</h4>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-3">Use the visual builder to create your workflow.</p>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>• Drag components from the sidebar</li>
                  <li>• Connect them with arrows</li>
                  <li>• Configure parameters for each step</li>
                </ul>
              </InteractiveCard>

              <InteractiveCard className="glass dark:glass-dark p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-flowbit-teal text-white rounded-full flex items-center justify-center font-bold mr-3">5</div>
                  <h4 className="font-semibold text-lg">Test & Run</h4>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-3">Execute your workflow and see results in real-time.</p>
                <div className="flex items-center text-sm text-flowbit-teal">
                  <FaPlay className="mr-2" />
                  <span>Click "Run" to execute your workflow</span>
                </div>
              </InteractiveCard>

              <InteractiveCard className="glass dark:glass-dark p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-flowbit-blue text-white rounded-full flex items-center justify-center font-bold mr-3">6</div>
                  <h4 className="font-semibold text-lg">Monitor & Optimize</h4>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-3">Track performance and improve your workflows.</p>
                <div className="flex items-center text-sm text-flowbit-blue">
                  <FaEye className="mr-2" />
                  <span>View execution logs and analytics</span>
                </div>
              </InteractiveCard>
            </motion.div>
          </motion.div>

          {/* Advanced Features */}
          <motion.div
            className="mt-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.h3 variants={fadeInUp} className="text-2xl font-bold text-center mb-8">Advanced Features</motion.h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ perspective: '800px' }}>
              <InteractiveCard className="glass dark:glass-dark p-6 rounded-xl shadow-lg text-center">
                <FaDownload className="text-3xl text-flowbit-teal mx-auto mb-3" />
                <h4 className="font-semibold mb-2">Import/Export</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Share workflows with your team or import existing ones</p>
              </InteractiveCard>

              <InteractiveCard className="glass dark:glass-dark p-6 rounded-xl shadow-lg text-center">
                <FaUpload className="text-3xl text-flowbit-blue mx-auto mb-3" />
                <h4 className="font-semibold mb-2">API Integration</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Connect with external services and APIs seamlessly</p>
              </InteractiveCard>

              <InteractiveCard className="glass dark:glass-dark p-6 rounded-xl shadow-lg text-center">
                <FaChartLine className="text-3xl text-flowbit-deep mx-auto mb-3" />
                <h4 className="font-semibold mb-2">Scheduling</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Set up automated triggers and scheduled executions</p>
              </InteractiveCard>
            </div>
          </motion.div>

          {/* Quick Start CTA */}
          <motion.div
            className="mt-12 text-center"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.5 }}
            variants={fadeInUp}
          >
            <div className="glass dark:glass-dark p-8 rounded-2xl shadow-xl max-w-2xl mx-auto" style={{ perspective: '800px' }}>
              <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">Follow these simple steps and you'll be automating workflows in minutes!</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup" className="px-6 py-3 rounded-full bg-flowbit-blue text-white font-semibold hover:bg-flowbit-deep transition">
                  Create Free Account
                </Link>
                <Link href="/dashboard" className="px-6 py-3 rounded-full bg-flowbit-teal text-white font-semibold hover:bg-flowbit-medium transition">
                  View Demo Dashboard
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        className="w-full flex flex-col items-center py-24 px-4"
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerContainer}
      >
        <div className="max-w-5xl w-full mx-auto">
          <motion.h2 variants={fadeInUp} className="text-3xl font-bold mb-12 text-center">Features</motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8" style={{ perspective: '800px' }}>
            <InteractiveCard className="glass dark:glass-dark p-6 rounded-2xl shadow-xl flex flex-col items-center">
              <FaCogs size={32} className="mb-2 text-flowbit-teal" />
              <span className="font-semibold">Drag & Drop Builder</span>
            </InteractiveCard>
            <InteractiveCard className="glass dark:glass-dark p-6 rounded-2xl shadow-xl flex flex-col items-center">
              <FaRocket size={32} className="mb-2 text-flowbit-blue" />
              <span className="font-semibold">Lightning Fast</span>
            </InteractiveCard>
            <InteractiveCard className="glass dark:glass-dark p-6 rounded-2xl shadow-xl flex flex-col items-center">
              <FaLock size={32} className="mb-2 text-flowbit-medium" />
              <span className="font-semibold">Enterprise Security</span>
            </InteractiveCard>
            <InteractiveCard className="glass dark:glass-dark p-6 rounded-2xl shadow-xl flex flex-col items-center">
              <FaChartLine size={32} className="mb-2 text-flowbit-deep" />
              <span className="font-semibold">Analytics & Insights</span>
            </InteractiveCard>
          </div>
        </div>
      </motion.section>

      {/* Get Started CTA */}
      <motion.section
        className="w-full flex flex-col items-center py-16 px-4 bg-gradient-to-r from-flowbit-teal via-flowbit-blue to-flowbit-deep"
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.5 }}
        variants={fadeInUp}
      >
        <div className="max-w-2xl w-full mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">Ready to build your first workflow?</h2>
          <p className="text-lg text-white/90 mb-8">Sign up now and start automating in minutes. No credit card required.</p>
          <Link href="/signup" className="px-10 py-4 rounded-full bg-white text-flowbit-blue font-bold shadow-lg hover:bg-flowbit-teal hover:text-white transition text-lg">Get Started</Link>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="w-full py-8 text-center text-gray-400 text-sm">
        Inspired by <a href="https://langflow.org" className="underline hover:text-flowbit-blue">Langflow</a>. &copy; {new Date().getFullYear()} Flowbit Orchestrator.
      </footer>
    </div>
  );
}