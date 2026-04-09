The data is set in euros, but instead in converting it to the user's currency, it is currently just like the currency is just swapped. So instead of saying 300 euros, instead of converting that to what 300 euros is equal to in pesos, it just converts like the currency that's offered. So instead of saying 300 euros, it says 300 pesos, when it should have been saying something like 20,000 pesos, like 300 euros is like 20,000 pesos. So it doesn't actually convert the currency, it just like changes the currency. Instead of 300, it just says 300 pesos. Guide are not enriched by Claude. The current converter does not ACTUALLY convert currencies. We would need a currency converter using a REAL API for currency conversion that translates from standard value (Whether it is by default in euro, or usd) to ALWAYS translate to the USER HOME CURRENCY. IF she is from Philippines, its pesos. If user from Sweden it should be to SEK etc. This applies to Numbeo, Cost of living, Budget Savings, Monthly savings etc. Cause right now this is a major issue. It causes the cost of living card to go bonkers: "Stockholm has a similar cost of living to Philippines.

Rent: 0%
Overall: 0%" Which is NOT true. And the budget plan "Budget Plan for Stockholm
Savings Goal

PHP 15 000

Current Savings

Edit
PHP 0

0% saved
PHP 15 000 to go
Total Target

PHP 15 000

Monthly Target

PHP 1 250

Months Left

12

Savings Milestones
1
Emergency fund covered

PHP 3 750
2
Halfway there!

PHP 7 500
3
Almost ready

PHP 11 250
4
Fully funded!

PHP 15 000
One-time Costs

PHP 8 150

Monthly Expenses

PHP 1 700/mo

Detailed Cost Breakdown
Visa & Immigration Fees

Residence permit application

PHP 150(one-time)

Flight & Initial Travel

One-way + luggage

PHP 800(one-time)

Security Deposit

3 months rent upfront

PHP 3 000(one-time)

First Month Rent

Sweden average

PHP 1 200(one-time)

Health Insurance

Public or private

PHP 200/month

Living Expenses

Food, transport, utilities

PHP 1 500/month

Emergency Fund

3 months buffer

PHP 3 000(one-time)" ALSO not true. MAJOR issue. Furthermore, this applies to the guide generation where it completely fails. 

THis is from Budget tab in Guide "Monthly Budget
Minimum
kr3 050 (~₱19 557)/mo
Comfortable
kr3 965 (~₱25 424)/mo
Breakdown
rent
kr1 800 (~₱11 542)
internet
kr50 (~₱321)
groceries
kr600 (~₱3 847)
utilities
kr195 (~₱1 250)
miscellaneous
kr300 (~₱1 924)
transportation
kr105 (~₱673)
Savings Target
kr22 325 (~₱143 152)
Save over Start saving now

Emergency Fund (3 months)
kr11 895 (~₱76 273)
Moving Costs
kr2 000 (~₱12 824)
Initial Setup
kr7 930 (~₱50 849)
Visa & Fees
kr500 (~₱3 206)" This is from the Housing Tab in the Guide "Finding housing in Sweden can be competitive, especially in major cities. Start your search early and be prepared to act quickly when you find a suitable place.

Average Rent
Studio

kr960/month

1 Bedroom

kr1200/month (city center)

2 Bedroom

kr1540/month". Which is SEVERLY incorrect. So we need to implement a UNIVERSAL Currency CONVERTER. That Converts REAL currency across the system. IF the standard currency aquired form the user or cost of living, budget plans and whatever. ALWAYS convert. Cost of living pulls in what, Euro? USD? Then it should convert to the users currency correctly. If Rent in X is €300 from Numbeo, then it is a MAJOR blocker that it states 300PHP on the dashboard. It should say 20862 PHP. we need a UNIVERSAL currency converting system with layers. Use a currency converter API, and implement ai usage to input fetched currency, and convert it to users currency and present that. 


Secondly, guide enrichment does NOT work at all. Claude does not enrich the guide at all which is a major bug. This NEEDS to be investigated WHY. 

Thirdly. NOR the Visa Recommendation OR Local Requirement show ANYTHING. Please investigate ALL of the issues above.

Use the following login details for test account:

TEST_NAME: lovedbythekind7@gmail.com
TEST_PASSWORD: rosecornelius92