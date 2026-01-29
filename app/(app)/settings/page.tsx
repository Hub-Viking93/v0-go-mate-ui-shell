"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { InfoCard } from "@/components/info-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  User,
  Globe,
  Bell,
  Moon,
  Shield,
  Download,
  Trash2,
  MapPin,
  Flag,
  Plane,
  Mail,
  Lock
} from "lucide-react"

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [weeklyDigest, setWeeklyDigest] = useState(true)

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-4xl">
      <PageHeader
        title="Settings"
        description="Manage your account preferences and privacy settings."
      />

      {/* Profile Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Profile
        </h2>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <Button variant="outline" size="sm" className="rounded-full bg-transparent">
                Change photo
              </Button>
            </div>

            {/* Profile Form */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" defaultValue="Alex Johnson" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="alex@example.com" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="citizenship" className="flex items-center gap-2">
                  <Flag className="w-3.5 h-3.5 text-muted-foreground" />
                  Citizenship
                </Label>
                <Input id="citizenship" defaultValue="United States" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination" className="flex items-center gap-2">
                  <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                  Target Destination
                </Label>
                <Input id="destination" defaultValue="Germany" className="rounded-xl" />
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button className="rounded-xl">Save changes</Button>
          </div>
        </div>
      </section>

      {/* Preferences Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          Preferences
        </h2>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {/* Theme */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary">
                <Moon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Switch to a darker color scheme</p>
              </div>
            </div>
            <Switch
              checked={darkMode}
              onCheckedChange={setDarkMode}
            />
          </div>

          {/* Language */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Language</p>
                <p className="text-sm text-muted-foreground">Choose your preferred language</p>
              </div>
            </div>
            <Badge variant="secondary">English</Badge>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notifications
        </h2>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {/* Email Notifications */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates about your relocation plan</p>
              </div>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          {/* Push Notifications */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Push Notifications</p>
                <p className="text-sm text-muted-foreground">Get notified about important deadlines</p>
              </div>
            </div>
            <Switch
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
            />
          </div>

          {/* Weekly Digest */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-secondary">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Weekly Progress Digest</p>
                <p className="text-sm text-muted-foreground">Summary of your relocation progress</p>
              </div>
            </div>
            <Switch
              checked={weeklyDigest}
              onCheckedChange={setWeeklyDigest}
            />
          </div>
        </div>
      </section>

      {/* Data & Privacy Section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Data & Privacy
        </h2>
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Your data privacy is important to us. GoMate stores your relocation preferences 
            and planning data securely. We never share your personal information with third 
            parties without your explicit consent.
          </p>
          
          <Separator />
          
          <div className="space-y-3">
            <Button variant="outline" className="w-full sm:w-auto gap-2 rounded-xl bg-transparent">
              <Download className="w-4 h-4" />
              Download my data
            </Button>
            <p className="text-xs text-muted-foreground">
              Export all your GoMate data including plans, preferences, and saved guides.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Button variant="outline" className="w-full sm:w-auto gap-2 rounded-xl text-destructive hover:text-destructive bg-transparent">
              <Trash2 className="w-4 h-4" />
              Delete my account
            </Button>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          Security
        </h2>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">Password</p>
              <p className="text-sm text-muted-foreground">Last changed 3 months ago</p>
            </div>
            <Button variant="outline" className="rounded-xl bg-transparent">
              Change password
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
