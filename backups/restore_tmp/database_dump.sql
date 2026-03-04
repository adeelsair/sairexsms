--
-- PostgreSQL database dump
--

\restrict 518bMp38tUb50jBq3oJTp44rGteOO6vQrbwsL26bLNMrQHoI2CUghohe2HLJnG0

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Campus; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Campus" (
    id integer NOT NULL,
    "organizationId" integer NOT NULL,
    "regionId" integer,
    name text NOT NULL,
    "campusCode" text NOT NULL,
    "campusSlug" text NOT NULL,
    address text,
    city text NOT NULL,
    "principalName" text,
    "contactPhone" text,
    email text,
    "academicStartMonth" integer DEFAULT 8 NOT NULL,
    "isMainCampus" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


ALTER TABLE public."Campus" OWNER TO postgres;

--
-- Name: Campus_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Campus_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Campus_id_seq" OWNER TO postgres;

--
-- Name: Campus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Campus_id_seq" OWNED BY public."Campus".id;


--
-- Name: FeeChallan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FeeChallan" (
    id integer NOT NULL,
    "organizationId" integer NOT NULL,
    "campusId" integer NOT NULL,
    "studentId" integer NOT NULL,
    "challanNo" text NOT NULL,
    "issueDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "totalAmount" numeric(65,30) NOT NULL,
    "paidAmount" numeric(65,30) DEFAULT 0.00 NOT NULL,
    status text DEFAULT 'UNPAID'::text NOT NULL,
    "paymentMethod" text,
    "paidAt" timestamp(3) without time zone,
    "generatedBy" text NOT NULL
);


ALTER TABLE public."FeeChallan" OWNER TO postgres;

--
-- Name: FeeChallan_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."FeeChallan_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."FeeChallan_id_seq" OWNER TO postgres;

--
-- Name: FeeChallan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."FeeChallan_id_seq" OWNED BY public."FeeChallan".id;


--
-- Name: FeeHead; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FeeHead" (
    id integer NOT NULL,
    "organizationId" integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    "isSystemDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FeeHead" OWNER TO postgres;

--
-- Name: FeeHead_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."FeeHead_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."FeeHead_id_seq" OWNER TO postgres;

--
-- Name: FeeHead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."FeeHead_id_seq" OWNED BY public."FeeHead".id;


--
-- Name: FeeStructure; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FeeStructure" (
    id integer NOT NULL,
    "organizationId" integer NOT NULL,
    "campusId" integer NOT NULL,
    "feeHeadId" integer NOT NULL,
    name text NOT NULL,
    amount numeric(65,30) DEFAULT 0.00 NOT NULL,
    currency text DEFAULT 'PKR'::text NOT NULL,
    frequency text NOT NULL,
    "applicableGrade" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FeeStructure" OWNER TO postgres;

--
-- Name: FeeStructure_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."FeeStructure_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."FeeStructure_id_seq" OWNER TO postgres;

--
-- Name: FeeStructure_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."FeeStructure_id_seq" OWNED BY public."FeeStructure".id;


--
-- Name: Organization; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Organization" (
    id integer NOT NULL,
    name text NOT NULL,
    "orgCode" text NOT NULL,
    logo text,
    website text,
    "taxRegNo" text,
    currency text DEFAULT 'PKR'::text NOT NULL,
    timezone text DEFAULT 'Asia/Karachi'::text NOT NULL,
    "brandingJson" jsonb,
    "subscriptionPlan" text DEFAULT 'FREE'::text NOT NULL,
    "subscriptionStatus" text DEFAULT 'ACTIVE'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Organization" OWNER TO postgres;

--
-- Name: Organization_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Organization_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Organization_id_seq" OWNER TO postgres;

--
-- Name: Organization_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Organization_id_seq" OWNED BY public."Organization".id;


--
-- Name: RegionalOffice; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RegionalOffice" (
    id integer NOT NULL,
    "organizationId" integer NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    "directorName" text,
    "contactEmail" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL
);


ALTER TABLE public."RegionalOffice" OWNER TO postgres;

--
-- Name: RegionalOffice_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."RegionalOffice_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RegionalOffice_id_seq" OWNER TO postgres;

--
-- Name: RegionalOffice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."RegionalOffice_id_seq" OWNED BY public."RegionalOffice".id;


--
-- Name: Student; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Student" (
    id integer NOT NULL,
    "fullName" text NOT NULL,
    "admissionNo" text NOT NULL,
    grade text NOT NULL,
    "feeStatus" text DEFAULT 'Unpaid'::text NOT NULL,
    "organizationId" integer NOT NULL,
    "campusId" integer NOT NULL
);


ALTER TABLE public."Student" OWNER TO postgres;

--
-- Name: Student_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Student_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Student_id_seq" OWNER TO postgres;

--
-- Name: Student_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Student_id_seq" OWNED BY public."Student".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    "campusId" integer,
    "isActive" boolean DEFAULT true NOT NULL,
    "organizationId" integer NOT NULL,
    password text NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: Campus id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Campus" ALTER COLUMN id SET DEFAULT nextval('public."Campus_id_seq"'::regclass);


--
-- Name: FeeChallan id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeChallan" ALTER COLUMN id SET DEFAULT nextval('public."FeeChallan_id_seq"'::regclass);


--
-- Name: FeeHead id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeHead" ALTER COLUMN id SET DEFAULT nextval('public."FeeHead_id_seq"'::regclass);


--
-- Name: FeeStructure id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeStructure" ALTER COLUMN id SET DEFAULT nextval('public."FeeStructure_id_seq"'::regclass);


--
-- Name: Organization id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Organization" ALTER COLUMN id SET DEFAULT nextval('public."Organization_id_seq"'::regclass);


--
-- Name: RegionalOffice id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RegionalOffice" ALTER COLUMN id SET DEFAULT nextval('public."RegionalOffice_id_seq"'::regclass);


--
-- Name: Student id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Student" ALTER COLUMN id SET DEFAULT nextval('public."Student_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: Campus; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Campus" (id, "organizationId", "regionId", name, "campusCode", "campusSlug", address, city, "principalName", "contactPhone", email, "academicStartMonth", "isMainCampus", status, "createdAt", "deletedAt") FROM stdin;
1	1	\N	Islamabad City Campus	ISB-01	islamabad-main	\N	Islamabad	\N	\N	\N	8	t	ACTIVE	2026-02-09 14:26:01.78	\N
4	5	1	Bani Gala	ISB-3	isb-3	\N	Islamabad	\N	\N	\N	8	f	ACTIVE	2026-02-10 17:20:43.493	\N
\.


--
-- Data for Name: FeeChallan; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FeeChallan" (id, "organizationId", "campusId", "studentId", "challanNo", "issueDate", "dueDate", "totalAmount", "paidAmount", status, "paymentMethod", "paidAt", "generatedBy") FROM stdin;
1	1	1	1	CH-ISB-2026-001-FEB26	2026-02-09 16:55:29.513	2026-02-19 21:55:29.511	5000.000000000000000000000000000000	5000.000000000000000000000000000000	PAID	CASH	2026-02-09 22:02:00.957	SYSTEM_AUTO
4	5	4	2	CH-4-2-FEB2026	2026-02-11 07:39:47.149	2026-02-11 00:00:00	70000.000000000000000000000000000000	70000.000000000000000000000000000000	PAID	BANK_TRANSFER	2026-02-11 08:11:56.41	SYSTEM_ADMIN
3	1	1	1	CH-1-1-FEB2026	2026-02-11 05:58:37.141	2026-02-11 00:00:00	5505.000000000000000000000000000000	5505.000000000000000000000000000000	PAID	ONLINE	2026-02-11 08:12:08.373	SYSTEM_ADMIN
\.


--
-- Data for Name: FeeHead; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FeeHead" (id, "organizationId", name, type, "isSystemDefault", "createdAt") FROM stdin;
1	1	Admission Fee	ONE_TIME	t	2026-02-09 16:54:53.357
2	1	Monthly Tuition	RECURRING	t	2026-02-09 16:54:53.393
3	1	Annual Development Charge	RECURRING	t	2026-02-09 16:54:53.403
4	1	Examination Fee	RECURRING	t	2026-02-09 16:54:53.414
5	1	Security Deposit (Refundable)	ONE_TIME	t	2026-02-09 16:54:53.426
6	5	Admission Fee	ONE_TIME	f	2026-02-11 02:14:07.071
7	5	Security Fee	ONE_TIME	f	2026-02-11 02:22:58.424
\.


--
-- Data for Name: FeeStructure; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FeeStructure" (id, "organizationId", "campusId", "feeHeadId", name, amount, currency, frequency, "applicableGrade", "isActive", "createdAt") FROM stdin;
1	1	1	2	Grade 10 - Standard Tuition (2026)	5000.000000000000000000000000000000	PKR	MONTHLY	Grade 10	t	2026-02-09 16:55:17.051
2	1	1	2	Monthly Fees Challans	505.000000000000000000000000000000	PKR	MONTHLY	Grade 10	t	2026-02-11 05:58:01.604
3	5	4	6	Admission	70000.000000000000000000000000000000	PKR	ONCE	4	t	2026-02-11 07:39:34.686
\.


--
-- Data for Name: Organization; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Organization" (id, name, "orgCode", logo, website, "taxRegNo", currency, timezone, "brandingJson", "subscriptionPlan", "subscriptionStatus", "isActive", "createdAt", "updatedAt") FROM stdin;
1	Sair Global Education	SAIR-GLOBAL	\N	\N	\N	PKR	Asia/Karachi	\N	PRO	ACTIVE	t	2026-02-09 14:26:01.761	2026-02-09 16:51:51.394
5	City School Network	TCS-PAK	\N	\N	\N	PKR	Asia/Karachi	\N	PRO	ACTIVE	t	2026-02-10 16:41:49.685	2026-02-10 16:41:49.685
\.


--
-- Data for Name: RegionalOffice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RegionalOffice" (id, "organizationId", name, city, "directorName", "contactEmail", status) FROM stdin;
1	5	Central	Islamabad	\N	\N	ACTIVE
\.


--
-- Data for Name: Student; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Student" (id, "fullName", "admissionNo", grade, "feeStatus", "organizationId", "campusId") FROM stdin;
1	Zain Sheikh	ISB-2026-001	Grade 10	Unpaid	1	1
2	Anaya Sair	123456	4	Unpaid	5	4
3	Aliza Sair	321654	11	Unpaid	1	1
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, role, "campusId", "isActive", "organizationId", password) FROM stdin;
1	admin@sair.com	ORG_ADMIN	1	t	1	securepassword123
\.


--
-- Name: Campus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Campus_id_seq"', 4, true);


--
-- Name: FeeChallan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."FeeChallan_id_seq"', 4, true);


--
-- Name: FeeHead_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."FeeHead_id_seq"', 7, true);


--
-- Name: FeeStructure_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."FeeStructure_id_seq"', 3, true);


--
-- Name: Organization_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Organization_id_seq"', 5, true);


--
-- Name: RegionalOffice_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."RegionalOffice_id_seq"', 1, true);


--
-- Name: Student_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Student_id_seq"', 3, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 3, true);


--
-- Name: Campus Campus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Campus"
    ADD CONSTRAINT "Campus_pkey" PRIMARY KEY (id);


--
-- Name: FeeChallan FeeChallan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeChallan"
    ADD CONSTRAINT "FeeChallan_pkey" PRIMARY KEY (id);


--
-- Name: FeeHead FeeHead_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeHead"
    ADD CONSTRAINT "FeeHead_pkey" PRIMARY KEY (id);


--
-- Name: FeeStructure FeeStructure_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeStructure"
    ADD CONSTRAINT "FeeStructure_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: RegionalOffice RegionalOffice_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RegionalOffice"
    ADD CONSTRAINT "RegionalOffice_pkey" PRIMARY KEY (id);


--
-- Name: Student Student_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Campus_campusCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Campus_campusCode_key" ON public."Campus" USING btree ("campusCode");


--
-- Name: Campus_campusSlug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Campus_campusSlug_key" ON public."Campus" USING btree ("campusSlug");


--
-- Name: FeeChallan_challanNo_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "FeeChallan_challanNo_key" ON public."FeeChallan" USING btree ("challanNo");


--
-- Name: Organization_orgCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Organization_orgCode_key" ON public."Organization" USING btree ("orgCode");


--
-- Name: Student_admissionNo_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Student_admissionNo_key" ON public."Student" USING btree ("admissionNo");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Campus Campus_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Campus"
    ADD CONSTRAINT "Campus_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Campus Campus_regionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Campus"
    ADD CONSTRAINT "Campus_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES public."RegionalOffice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FeeChallan FeeChallan_campusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeChallan"
    ADD CONSTRAINT "FeeChallan_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES public."Campus"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FeeChallan FeeChallan_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeChallan"
    ADD CONSTRAINT "FeeChallan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FeeChallan FeeChallan_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeChallan"
    ADD CONSTRAINT "FeeChallan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FeeHead FeeHead_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeHead"
    ADD CONSTRAINT "FeeHead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FeeStructure FeeStructure_campusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeStructure"
    ADD CONSTRAINT "FeeStructure_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES public."Campus"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FeeStructure FeeStructure_feeHeadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeStructure"
    ADD CONSTRAINT "FeeStructure_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES public."FeeHead"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FeeStructure FeeStructure_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeeStructure"
    ADD CONSTRAINT "FeeStructure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RegionalOffice RegionalOffice_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RegionalOffice"
    ADD CONSTRAINT "RegionalOffice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Student Student_campusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES public."Campus"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Student Student_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_campusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES public."Campus"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict 518bMp38tUb50jBq3oJTp44rGteOO6vQrbwsL26bLNMrQHoI2CUghohe2HLJnG0

