--
-- PostgreSQL database dump
--

\restrict 0MJhCSCCCioUOJhxPNKkCJ5vlW9lgScwVDEk58rO3DCCP1wRKRUw60nAfP49uXW

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

-- Started on 2026-08-20 16:25:22

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

--
-- TOC entry 312 (class 1255 OID 18521)
-- Name: log_accident_event(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_accident_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 1. Проставляем текущее время в actual_date таблицы accidents (как вы и хотели ранее)
    NEW.actual_date := NOW();

    -- 2. Автоматически добавляем запись в историю (accident_events)
    -- Вставляем текст из поля description, текущую дату/время и ID текущего ДТП
    INSERT INTO accident_events (dtp_id, event_date, event_text)
    VALUES (NEW.id, NOW(), COALESCE(NEW.description, ''));

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_accident_event() OWNER TO postgres;

--
-- TOC entry 313 (class 1255 OID 18522)
-- Name: set_actual_date_always(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_actual_date_always() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Проставляем текущие дату и время при создании новой записи или изменении статуса
    -- (Можно убрать проверку на смену статуса, чтобы время обновлялось вообще при любом сохранении карточки)
    NEW.actual_date := NOW();
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_actual_date_always() OWNER TO postgres;

--
-- TOC entry 321 (class 1255 OID 20589)
-- Name: sync_mol_user_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_mol_user_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- При добавлении пользователя добавляем его имя в mol_users
        INSERT INTO mol_users (id, name) VALUES (NEW.id, NEW.name);
        RETURN NEW;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        -- При изменении имени обновляем его в mol_users
        UPDATE mol_users SET name = NEW.name WHERE id = NEW.id;
        RETURN NEW;
        
    ELSIF (TG_OP = 'DELETE') THEN
        -- При удалении пользователя удаляем его из mol_users
        DELETE FROM mol_users WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.sync_mol_user_trigger() OWNER TO postgres;

--
-- TOC entry 314 (class 1255 OID 18523)
-- Name: update_accident_description(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_accident_description() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Обновляем поле description в таблице accidents последним введенным текстом события
    UPDATE accidents
    SET description = NEW.event_text,
        actual_date = NOW() -- Если нужно также обновлять дату факт при добавлении события
    WHERE id = NEW.dtp_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_accident_description() OWNER TO postgres;

--
-- TOC entry 315 (class 1255 OID 18524)
-- Name: update_accident_invoice_sum(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_accident_invoice_sum() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    target_dtp_id INTEGER;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_dtp_id := OLD.dtp_id;
    ELSE
        target_dtp_id := NEW.dtp_id;
    END IF;

    IF target_dtp_id IS NOT NULL THEN
        UPDATE accidents 
        SET account_number = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM accident_invoices 
            WHERE dtp_id = target_dtp_id
        )
        WHERE id = target_dtp_id;
    END IF;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_accident_invoice_sum() OWNER TO postgres;

--
-- TOC entry 316 (class 1255 OID 18525)
-- Name: update_accident_paid_amount(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_accident_paid_amount() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Обновляем поле paid_amount в таблице accidents на основе суммы всех записей из accident_payments для текущего ДТП
    UPDATE accidents
    SET paid_amount = COALESCE((
        SELECT SUM(amount) 
        FROM accident_payments 
        WHERE dtp_id = COALESCE(NEW.dtp_id, OLD.dtp_id)
    ), 0)
    WHERE id = COALESCE(NEW.dtp_id, OLD.dtp_id);
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_accident_paid_amount() OWNER TO postgres;

--
-- TOC entry 317 (class 1255 OID 18526)
-- Name: update_move_total_sum(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_move_total_sum() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    target_move_id INT;
    is_doc_posted BOOLEAN;
BEGIN
    -- Определяем ID перемещения в зависимости от действия
    IF (TG_OP = 'DELETE') THEN
        target_move_id := OLD.move_id;
    ELSE
        target_move_id := NEW.move_id;
    END IF;

    IF target_move_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Проверяем, проведен ли документ (сравниваем только с boolean)
    SELECT is_posted INTO is_doc_posted FROM moves WHERE id = target_move_id;
    
    IF is_doc_posted = true OR is_doc_posted = 'true' THEN
        IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- Пересчитываем общую сумму
    UPDATE moves 
    SET sum_rub = (
        SELECT COALESCE(SUM(total_rub), 0) 
        FROM move_items 
        WHERE move_id = target_move_id
    )
    WHERE id = target_move_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION public.update_move_total_sum() OWNER TO postgres;

--
-- TOC entry 318 (class 1255 OID 18527)
-- Name: update_receipt_fact_date(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_receipt_fact_date() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Если документ создается или обновляется со статусом "Проведен" (true)
    IF NEW.is_posted = TRUE THEN
        -- Если это новая запись ИЛИ раньше документ не был проверен, ставим текущую дату и время
        IF (TG_OP = 'INSERT') OR (OLD.is_posted IS NOT TRUE) OR (OLD.fact_date IS NULL) THEN
            NEW.fact_date := NOW();
        END IF;
    ELSE
        -- Если документ не проведен (false), дата факта должна быть пустой
        NEW.fact_date := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_receipt_fact_date() OWNER TO postgres;

--
-- TOC entry 319 (class 1255 OID 18528)
-- Name: update_receipt_total_sum(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_receipt_total_sum() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Обновляем sum_rub в таблице receipts для конкретного документа
    UPDATE receipts
    SET sum_rub = (
        SELECT COALESCE(SUM(total_rub), 0)
        FROM receipt_items
        WHERE receipt_id = COALESCE(NEW.receipt_id, OLD.receipt_id)
    )
    WHERE id = COALESCE(NEW.receipt_id, OLD.receipt_id);
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_receipt_total_sum() OWNER TO postgres;

--
-- TOC entry 320 (class 1255 OID 18529)
-- Name: update_repair_total(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_repair_total() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE repairs 
    SET sum = (
        SELECT COALESCE(SUM(total), 0) 
        FROM repair_items 
        WHERE repair_id = COALESCE(NEW.repair_id, OLD.repair_id)
    )
    WHERE id = COALESCE(NEW.repair_id, OLD.repair_id);
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_repair_total() OWNER TO postgres;

--
-- TOC entry 333 (class 1255 OID 18530)
-- Name: update_repair_total_sum(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_repair_total_sum() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    target_repair_id INT;
BEGIN
    -- Определяем, какому ремонту принадлежит запись (при INSERT/UPDATE берем NEW, при DELETE — OLD)
    IF (TG_OP = 'DELETE') THEN
        target_repair_id := OLD.repair_id;
    ELSE
        target_repair_id := NEW.repair_id;
    END IF;

    -- Если repair_id указан, пересчитываем сумму всех работ для этого ремонта
    IF target_repair_id IS NOT NULL THEN
        UPDATE repairs
        SET sum = (
            SELECT COALESCE(SUM(price), 0)
            FROM repair_works
            WHERE repair_id = target_repair_id
        )
        WHERE id = target_repair_id;
    END IF;

    -- Если это UPDATE и поменялся repair_id (перенесли работу в другой ремонт), 
    -- то пересчитываем также сумму для старого ремонта
    IF (TG_OP = 'UPDATE' AND OLD.repair_id IS DISTINCT FROM NEW.repair_id AND OLD.repair_id IS NOT NULL) THEN
        UPDATE repairs
        SET sum = (
            SELECT COALESCE(SUM(price), 0)
            FROM repair_works
            WHERE repair_id = OLD.repair_id
        )
        WHERE id = OLD.repair_id;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_repair_total_sum() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 219 (class 1259 OID 18531)
-- Name: accident_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accident_events (
    id integer NOT NULL,
    dtp_id integer,
    event_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    event_text text
);


ALTER TABLE public.accident_events OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 18538)
-- Name: accident_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accident_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accident_events_id_seq OWNER TO postgres;

--
-- TOC entry 5648 (class 0 OID 0)
-- Dependencies: 220
-- Name: accident_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accident_events_id_seq OWNED BY public.accident_events.id;


--
-- TOC entry 221 (class 1259 OID 18539)
-- Name: accident_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accident_invoices (
    id integer NOT NULL,
    dtp_id integer,
    invoice_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    debtor character varying(255),
    amount numeric(12,2) DEFAULT 0.00,
    description text
);


ALTER TABLE public.accident_invoices OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 18547)
-- Name: accident_invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accident_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accident_invoices_id_seq OWNER TO postgres;

--
-- TOC entry 5649 (class 0 OID 0)
-- Dependencies: 222
-- Name: accident_invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accident_invoices_id_seq OWNED BY public.accident_invoices.id;


--
-- TOC entry 223 (class 1259 OID 18548)
-- Name: accident_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accident_payments (
    id integer NOT NULL,
    dtp_id integer,
    payment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    payer character varying(255),
    amount numeric(12,2) DEFAULT 0.00,
    payment_type character varying(100),
    description text,
    payment_type_id integer
);


ALTER TABLE public.accident_payments OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 18556)
-- Name: accident_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accident_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accident_payments_id_seq OWNER TO postgres;

--
-- TOC entry 5650 (class 0 OID 0)
-- Dependencies: 224
-- Name: accident_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accident_payments_id_seq OWNED BY public.accident_payments.id;


--
-- TOC entry 225 (class 1259 OID 18557)
-- Name: accident_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accident_statuses (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.accident_statuses OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 18562)
-- Name: accident_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accident_statuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accident_statuses_id_seq OWNER TO postgres;

--
-- TOC entry 5651 (class 0 OID 0)
-- Dependencies: 226
-- Name: accident_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accident_statuses_id_seq OWNED BY public.accident_statuses.id;


--
-- TOC entry 227 (class 1259 OID 18563)
-- Name: accidents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accidents (
    id integer NOT NULL,
    car_id integer NOT NULL,
    doc_number character varying(100),
    doc_date timestamp without time zone DEFAULT CURRENT_DATE,
    fact_date timestamp without time zone DEFAULT CURRENT_DATE,
    detected_date timestamp without time zone DEFAULT CURRENT_DATE,
    driver character varying(255),
    culprit character varying(255),
    damage_amount numeric(12,2) DEFAULT 0,
    account_number character varying(100),
    paid_amount numeric(12,2) DEFAULT 0,
    description text,
    actual_date timestamp without time zone,
    status_id integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.accidents OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 18577)
-- Name: accidents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accidents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accidents_id_seq OWNER TO postgres;

--
-- TOC entry 5652 (class 0 OID 0)
-- Dependencies: 228
-- Name: accidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accidents_id_seq OWNED BY public.accidents.id;


--
-- TOC entry 229 (class 1259 OID 18578)
-- Name: autoservices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.autoservices (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.autoservices OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 18583)
-- Name: autoservices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.autoservices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.autoservices_id_seq OWNER TO postgres;

--
-- TOC entry 5653 (class 0 OID 0)
-- Dependencies: 230
-- Name: autoservices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.autoservices_id_seq OWNED BY public.autoservices.id;


--
-- TOC entry 231 (class 1259 OID 18584)
-- Name: autostrahovanie; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.autostrahovanie (
    id integer NOT NULL,
    doc_number character varying(50) NOT NULL,
    date timestamp without time zone DEFAULT now(),
    car_id integer,
    autoservice_id integer,
    insurance_current timestamp without time zone,
    insurance_next timestamp without time zone,
    sum numeric(12,2) DEFAULT 0.00,
    payment_type_id integer,
    description text,
    fact_date timestamp without time zone,
    is_posted boolean DEFAULT false
);


ALTER TABLE public.autostrahovanie OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 18594)
-- Name: autostrahovanie_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.autostrahovanie_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.autostrahovanie_id_seq OWNER TO postgres;

--
-- TOC entry 5654 (class 0 OID 0)
-- Dependencies: 232
-- Name: autostrahovanie_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.autostrahovanie_id_seq OWNED BY public.autostrahovanie.id;


--
-- TOC entry 233 (class 1259 OID 18595)
-- Name: car_brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_brands (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.car_brands OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 18602)
-- Name: car_brands_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.car_brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.car_brands_id_seq OWNER TO postgres;

--
-- TOC entry 5655 (class 0 OID 0)
-- Dependencies: 234
-- Name: car_brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.car_brands_id_seq OWNED BY public.car_brands.id;


--
-- TOC entry 235 (class 1259 OID 18603)
-- Name: car_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_models (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    brand_id integer,
    fuel_type character varying(100),
    engine character varying(100),
    start_date date,
    end_date date,
    description text,
    body_id integer,
    kyzov_type_id integer,
    toplivo_id integer
);


ALTER TABLE public.car_models OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 18610)
-- Name: car_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.car_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.car_models_id_seq OWNER TO postgres;

--
-- TOC entry 5656 (class 0 OID 0)
-- Dependencies: 236
-- Name: car_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.car_models_id_seq OWNED BY public.car_models.id;


--
-- TOC entry 237 (class 1259 OID 18611)
-- Name: car_repairs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_repairs (
    id integer NOT NULL,
    car_id integer,
    repair_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    repair_type_id integer,
    mileage integer,
    total_cost numeric(12,2) DEFAULT 0,
    description text
);


ALTER TABLE public.car_repairs OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 18619)
-- Name: car_repairs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.car_repairs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.car_repairs_id_seq OWNER TO postgres;

--
-- TOC entry 5657 (class 0 OID 0)
-- Dependencies: 238
-- Name: car_repairs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.car_repairs_id_seq OWNED BY public.car_repairs.id;


--
-- TOC entry 239 (class 1259 OID 18620)
-- Name: cars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cars (
    id integer NOT NULL,
    gos_number character varying(50) NOT NULL,
    model character varying(100),
    body character varying(50),
    engine character varying(50),
    year integer,
    color character varying(50),
    vin character varying(100),
    pto_current date,
    pto_next date,
    insurance_current date,
    insurance_next date,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    model_id integer,
    toplivo_id integer
);


ALTER TABLE public.cars OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 18628)
-- Name: cars_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cars_id_seq OWNER TO postgres;

--
-- TOC entry 5658 (class 0 OID 0)
-- Dependencies: 240
-- Name: cars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cars_id_seq OWNED BY public.cars.id;


--
-- TOC entry 241 (class 1259 OID 18629)
-- Name: counterparties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counterparties (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    short_name character varying(100),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    counterparty_type_id integer
);


ALTER TABLE public.counterparties OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 18637)
-- Name: counterparties_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.counterparties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.counterparties_id_seq OWNER TO postgres;

--
-- TOC entry 5659 (class 0 OID 0)
-- Dependencies: 242
-- Name: counterparties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counterparties_id_seq OWNED BY public.counterparties.id;


--
-- TOC entry 243 (class 1259 OID 18638)
-- Name: counterparty_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counterparty_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_pto boolean DEFAULT false,
    is_insurance boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.counterparty_types OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 18648)
-- Name: counterparty_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.counterparty_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.counterparty_types_id_seq OWNER TO postgres;

--
-- TOC entry 5660 (class 0 OID 0)
-- Dependencies: 244
-- Name: counterparty_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counterparty_types_id_seq OWNED BY public.counterparty_types.id;


--
-- TOC entry 245 (class 1259 OID 18649)
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    type_id integer CONSTRAINT customers_type_not_null NOT NULL,
    name_full character varying(255) NOT NULL,
    name_short character varying(100),
    discount_parts character varying(100),
    discount_services character varying(100),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 18658)
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- TOC entry 5661 (class 0 OID 0)
-- Dependencies: 246
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- TOC entry 247 (class 1259 OID 18659)
-- Name: doc_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doc_types (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text
);


ALTER TABLE public.doc_types OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 18666)
-- Name: doc_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.doc_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.doc_types_id_seq OWNER TO postgres;

--
-- TOC entry 5662 (class 0 OID 0)
-- Dependencies: 248
-- Name: doc_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.doc_types_id_seq OWNED BY public.doc_types.id;


--
-- TOC entry 249 (class 1259 OID 18667)
-- Name: ed_izmereniya; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ed_izmereniya (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    short_name character varying(50) NOT NULL,
    regex_pattern character varying(255),
    error_text text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ed_izmereniya OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 18676)
-- Name: ed_izmereniya_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ed_izmereniya_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ed_izmereniya_id_seq OWNER TO postgres;

--
-- TOC entry 5663 (class 0 OID 0)
-- Dependencies: 250
-- Name: ed_izmereniya_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ed_izmereniya_id_seq OWNED BY public.ed_izmereniya.id;


--
-- TOC entry 251 (class 1259 OID 18677)
-- Name: gruppa_tsen; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gruppa_tsen (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    markup_percent numeric(5,2) DEFAULT 0 NOT NULL,
    rounding integer DEFAULT 1 NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.gruppa_tsen OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 18689)
-- Name: gruppa_tsen_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gruppa_tsen_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gruppa_tsen_id_seq OWNER TO postgres;

--
-- TOC entry 5664 (class 0 OID 0)
-- Dependencies: 252
-- Name: gruppa_tsen_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gruppa_tsen_id_seq OWNED BY public.gruppa_tsen.id;


--
-- TOC entry 253 (class 1259 OID 18690)
-- Name: gryppa_zamehenia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gryppa_zamehenia (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    control_km boolean DEFAULT false,
    normative_mileage integer DEFAULT 0,
    warning_1 integer DEFAULT 0,
    warning_2 integer DEFAULT 0,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.gryppa_zamehenia OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 18702)
-- Name: gryppa_zamehenia_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gryppa_zamehenia_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gryppa_zamehenia_id_seq OWNER TO postgres;

--
-- TOC entry 5665 (class 0 OID 0)
-- Dependencies: 254
-- Name: gryppa_zamehenia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gryppa_zamehenia_id_seq OWNED BY public.gryppa_zamehenia.id;


--
-- TOC entry 255 (class 1259 OID 18703)
-- Name: ispolnitel; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ispolnitel (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ispolnitel OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 18711)
-- Name: ispolnitel_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ispolnitel_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ispolnitel_id_seq OWNER TO postgres;

--
-- TOC entry 5666 (class 0 OID 0)
-- Dependencies: 256
-- Name: ispolnitel_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ispolnitel_id_seq OWNED BY public.ispolnitel.id;


--
-- TOC entry 257 (class 1259 OID 18712)
-- Name: kyzov_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kyzov_type (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.kyzov_type OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 18719)
-- Name: kyzov_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kyzov_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kyzov_type_id_seq OWNER TO postgres;

--
-- TOC entry 5667 (class 0 OID 0)
-- Dependencies: 258
-- Name: kyzov_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kyzov_type_id_seq OWNED BY public.kyzov_type.id;


--
-- TOC entry 259 (class 1259 OID 18720)
-- Name: mol; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mol (
    id integer NOT NULL,
    date_assigned timestamp without time zone,
    date_removed timestamp without time zone,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer,
    warehouse_id integer
);


ALTER TABLE public.mol OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 18727)
-- Name: mol_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.mol_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mol_id_seq OWNER TO postgres;

--
-- TOC entry 5668 (class 0 OID 0)
-- Dependencies: 260
-- Name: mol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mol_id_seq OWNED BY public.mol.id;


--
-- TOC entry 311 (class 1259 OID 20580)
-- Name: mol_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mol_users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.mol_users OWNER TO postgres;

--
-- TOC entry 310 (class 1259 OID 20579)
-- Name: mol_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.mol_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mol_users_id_seq OWNER TO postgres;

--
-- TOC entry 5669 (class 0 OID 0)
-- Dependencies: 310
-- Name: mol_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mol_users_id_seq OWNED BY public.mol_users.id;


--
-- TOC entry 261 (class 1259 OID 18728)
-- Name: move_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.move_items (
    id integer NOT NULL,
    move_id integer,
    zaphasti_id integer,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    price numeric(12,2) DEFAULT 0,
    total_rub numeric(12,2) DEFAULT 0,
    description text,
    currency character varying(50) DEFAULT 'Рубль ПМР'::character varying,
    price_rub numeric(12,2),
    income_document_id integer
);


ALTER TABLE public.move_items OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 18739)
-- Name: move_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.move_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.move_items_id_seq OWNER TO postgres;

--
-- TOC entry 5670 (class 0 OID 0)
-- Dependencies: 262
-- Name: move_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.move_items_id_seq OWNED BY public.move_items.id;


--
-- TOC entry 263 (class 1259 OID 18740)
-- Name: moves; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.moves (
    id integer NOT NULL,
    doc_number character varying(50),
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    warehouse_from_id integer,
    mol_from_id integer,
    warehouse_to_id integer,
    mol_to_id integer,
    description text,
    sum_rub numeric(12,2) DEFAULT 0,
    fact_date timestamp without time zone,
    is_posted boolean DEFAULT false
);


ALTER TABLE public.moves OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 18749)
-- Name: moves_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.moves_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.moves_id_seq OWNER TO postgres;

--
-- TOC entry 5671 (class 0 OID 0)
-- Dependencies: 264
-- Name: moves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.moves_id_seq OWNED BY public.moves.id;


--
-- TOC entry 265 (class 1259 OID 18750)
-- Name: ostatok_zaphastei; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ostatok_zaphastei (
    id integer NOT NULL,
    article character varying(100),
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    manufacturer character varying(255),
    price_group character varying(100),
    description text,
    warehouse_name character varying(255) NOT NULL,
    mol_name character varying(255) NOT NULL,
    quantity numeric(10,2) DEFAULT 0.00,
    unit character varying(50) DEFAULT 'шт'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ostatok_zaphastei OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 18763)
-- Name: ostatok_zaphastei_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ostatok_zaphastei_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ostatok_zaphastei_id_seq OWNER TO postgres;

--
-- TOC entry 5672 (class 0 OID 0)
-- Dependencies: 266
-- Name: ostatok_zaphastei_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ostatok_zaphastei_id_seq OWNED BY public.ostatok_zaphastei.id;


--
-- TOC entry 267 (class 1259 OID 18764)
-- Name: payment_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_types (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.payment_types OWNER TO postgres;

--
-- TOC entry 268 (class 1259 OID 18769)
-- Name: payment_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_types_id_seq OWNER TO postgres;

--
-- TOC entry 5673 (class 0 OID 0)
-- Dependencies: 268
-- Name: payment_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_types_id_seq OWNED BY public.payment_types.id;


--
-- TOC entry 269 (class 1259 OID 18770)
-- Name: postavhik; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.postavhik (
    id integer NOT NULL,
    type_id integer,
    name character varying(200) NOT NULL,
    short_name character varying(100),
    description text
);


ALTER TABLE public.postavhik OWNER TO postgres;

--
-- TOC entry 270 (class 1259 OID 18777)
-- Name: postavhik_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.postavhik_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.postavhik_id_seq OWNER TO postgres;

--
-- TOC entry 5674 (class 0 OID 0)
-- Dependencies: 270
-- Name: postavhik_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.postavhik_id_seq OWNED BY public.postavhik.id;


--
-- TOC entry 271 (class 1259 OID 18778)
-- Name: proizvoditel_zaphasti; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proizvoditel_zaphasti (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.proizvoditel_zaphasti OWNER TO postgres;

--
-- TOC entry 272 (class 1259 OID 18786)
-- Name: proizvoditel_zaphasti_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.proizvoditel_zaphasti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.proizvoditel_zaphasti_id_seq OWNER TO postgres;

--
-- TOC entry 5675 (class 0 OID 0)
-- Dependencies: 272
-- Name: proizvoditel_zaphasti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.proizvoditel_zaphasti_id_seq OWNED BY public.proizvoditel_zaphasti.id;


--
-- TOC entry 273 (class 1259 OID 18787)
-- Name: receipt_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.receipt_items (
    id integer NOT NULL,
    receipt_id integer,
    zaphasti_id integer,
    quantity numeric(10,2) DEFAULT 1.00 NOT NULL,
    price numeric(12,2) DEFAULT 0.00 NOT NULL,
    currency character varying(20) DEFAULT 'Рубль ПМР'::character varying,
    price_rub numeric(12,2) DEFAULT 0.00 NOT NULL,
    total_rub numeric(12,2) DEFAULT 0.00 NOT NULL,
    description text
);


ALTER TABLE public.receipt_items OWNER TO postgres;

--
-- TOC entry 274 (class 1259 OID 18802)
-- Name: receipt_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.receipt_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.receipt_items_id_seq OWNER TO postgres;

--
-- TOC entry 5676 (class 0 OID 0)
-- Dependencies: 274
-- Name: receipt_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.receipt_items_id_seq OWNED BY public.receipt_items.id;


--
-- TOC entry 275 (class 1259 OID 18803)
-- Name: receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.receipts (
    id integer NOT NULL,
    doc_number character varying(50) NOT NULL,
    date timestamp without time zone DEFAULT now() NOT NULL,
    warehouse_id integer,
    mol_id integer,
    supplier_id integer,
    sum_rub numeric(12,2) DEFAULT 0.00,
    fact_date timestamp without time zone,
    is_posted boolean DEFAULT false,
    description text
);


ALTER TABLE public.receipts OWNER TO postgres;

--
-- TOC entry 276 (class 1259 OID 18814)
-- Name: receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.receipts_id_seq OWNER TO postgres;

--
-- TOC entry 5677 (class 0 OID 0)
-- Dependencies: 276
-- Name: receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.receipts_id_seq OWNED BY public.receipts.id;


--
-- TOC entry 277 (class 1259 OID 18815)
-- Name: repair_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repair_documents (
    id integer NOT NULL,
    doc_number character varying(100) NOT NULL,
    doc_date timestamp without time zone NOT NULL,
    doc_type character varying(100) NOT NULL,
    repair_type character varying(100) NOT NULL,
    car_number character varying(50) NOT NULL,
    car_model character varying(100) NOT NULL,
    mileage integer DEFAULT 0,
    warehouse_service character varying(255) NOT NULL,
    description text,
    total_sum numeric(12,2) DEFAULT 0.00,
    fact_date timestamp without time zone,
    status character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.repair_documents OWNER TO postgres;

--
-- TOC entry 278 (class 1259 OID 18831)
-- Name: repair_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repair_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repair_documents_id_seq OWNER TO postgres;

--
-- TOC entry 5678 (class 0 OID 0)
-- Dependencies: 278
-- Name: repair_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repair_documents_id_seq OWNED BY public.repair_documents.id;


--
-- TOC entry 279 (class 1259 OID 18832)
-- Name: repair_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repair_items (
    id integer NOT NULL,
    repair_id integer,
    zaphast_id integer,
    article character varying(100),
    code character varying(100),
    name character varying(255),
    quantity numeric(10,2),
    unit character varying(50),
    price numeric(12,2),
    total numeric(12,2),
    description text,
    receipt_doc character varying(255),
    receipt_id integer
);


ALTER TABLE public.repair_items OWNER TO postgres;

--
-- TOC entry 280 (class 1259 OID 18838)
-- Name: repair_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repair_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repair_items_id_seq OWNER TO postgres;

--
-- TOC entry 5679 (class 0 OID 0)
-- Dependencies: 280
-- Name: repair_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repair_items_id_seq OWNED BY public.repair_items.id;


--
-- TOC entry 281 (class 1259 OID 18839)
-- Name: repair_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repair_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.repair_types OWNER TO postgres;

--
-- TOC entry 282 (class 1259 OID 18847)
-- Name: repair_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repair_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repair_types_id_seq OWNER TO postgres;

--
-- TOC entry 5680 (class 0 OID 0)
-- Dependencies: 282
-- Name: repair_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repair_types_id_seq OWNED BY public.repair_types.id;


--
-- TOC entry 283 (class 1259 OID 18848)
-- Name: repair_works; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repair_works (
    id integer NOT NULL,
    repair_id integer NOT NULL,
    ispolnitel_id integer,
    work_id integer,
    price numeric(12,2) DEFAULT 0.00,
    description text
);


ALTER TABLE public.repair_works OWNER TO postgres;

--
-- TOC entry 284 (class 1259 OID 18856)
-- Name: repair_works_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repair_works_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repair_works_id_seq OWNER TO postgres;

--
-- TOC entry 5681 (class 0 OID 0)
-- Dependencies: 284
-- Name: repair_works_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repair_works_id_seq OWNED BY public.repair_works.id;


--
-- TOC entry 285 (class 1259 OID 18857)
-- Name: repairs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repairs (
    id integer NOT NULL,
    doc_number character varying(50),
    doc_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    repair_type_id integer,
    car_id integer,
    mileage integer,
    doc_type_id integer,
    warehouse_id integer,
    mol_id integer,
    description text,
    sum numeric(12,2) DEFAULT 0.00,
    doc_type integer,
    is_posted boolean DEFAULT false,
    fact_date timestamp without time zone
);


ALTER TABLE public.repairs OWNER TO postgres;

--
-- TOC entry 286 (class 1259 OID 18866)
-- Name: repairs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repairs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repairs_id_seq OWNER TO postgres;

--
-- TOC entry 5682 (class 0 OID 0)
-- Dependencies: 286
-- Name: repairs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repairs_id_seq OWNED BY public.repairs.id;


--
-- TOC entry 287 (class 1259 OID 18867)
-- Name: type_sklad; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.type_sklad (
    id integer CONSTRAINT sklad_id_not_null NOT NULL,
    name character varying(255) CONSTRAINT sklad_name_not_null NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.type_sklad OWNER TO postgres;

--
-- TOC entry 288 (class 1259 OID 18875)
-- Name: sklad_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sklad_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sklad_id_seq OWNER TO postgres;

--
-- TOC entry 5683 (class 0 OID 0)
-- Dependencies: 288
-- Name: sklad_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sklad_id_seq OWNED BY public.type_sklad.id;


--
-- TOC entry 289 (class 1259 OID 18876)
-- Name: skladi; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skladi (
    id integer NOT NULL,
    type_sklad_id integer,
    name character varying(255) NOT NULL,
    description text
);


ALTER TABLE public.skladi OWNER TO postgres;

--
-- TOC entry 290 (class 1259 OID 18883)
-- Name: skladi_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.skladi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.skladi_id_seq OWNER TO postgres;

--
-- TOC entry 5684 (class 0 OID 0)
-- Dependencies: 290
-- Name: skladi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.skladi_id_seq OWNED BY public.skladi.id;


--
-- TOC entry 291 (class 1259 OID 18884)
-- Name: statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statuses (
    id boolean NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.statuses OWNER TO postgres;

--
-- TOC entry 292 (class 1259 OID 18889)
-- Name: tehosmotr; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tehosmotr (
    id integer NOT NULL,
    doc_number character varying(50),
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    to_date timestamp without time zone,
    next_to_date timestamp without time zone,
    car_id integer,
    autoservice character varying(255),
    sum numeric(10,2),
    payment_type character varying(100),
    description text,
    is_posted boolean DEFAULT false,
    fact_date timestamp without time zone,
    payment_type_id integer
);


ALTER TABLE public.tehosmotr OWNER TO postgres;

--
-- TOC entry 293 (class 1259 OID 18897)
-- Name: tehosmotr_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tehosmotr_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tehosmotr_id_seq OWNER TO postgres;

--
-- TOC entry 5685 (class 0 OID 0)
-- Dependencies: 293
-- Name: tehosmotr_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tehosmotr_id_seq OWNED BY public.tehosmotr.id;


--
-- TOC entry 294 (class 1259 OID 18898)
-- Name: toplivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.toplivo (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    account_tmc character varying(50),
    account_expense character varying(50),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.toplivo OWNER TO postgres;

--
-- TOC entry 295 (class 1259 OID 18906)
-- Name: toplivo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.toplivo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.toplivo_id_seq OWNER TO postgres;

--
-- TOC entry 5686 (class 0 OID 0)
-- Dependencies: 295
-- Name: toplivo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.toplivo_id_seq OWNED BY public.toplivo.id;


--
-- TOC entry 296 (class 1259 OID 18907)
-- Name: transfer_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transfer_documents (
    id integer NOT NULL,
    doc_number character varying(50) NOT NULL,
    doc_date timestamp without time zone NOT NULL,
    warehouse_from character varying(255) NOT NULL,
    mol_from character varying(255) NOT NULL,
    warehouse_to character varying(255) NOT NULL,
    mol_to character varying(255) NOT NULL,
    description text,
    total_sum numeric(12,2) DEFAULT 0.00,
    fact_date timestamp without time zone,
    status character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.transfer_documents OWNER TO postgres;

--
-- TOC entry 297 (class 1259 OID 18921)
-- Name: transfer_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transfer_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transfer_documents_id_seq OWNER TO postgres;

--
-- TOC entry 5687 (class 0 OID 0)
-- Dependencies: 297
-- Name: transfer_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transfer_documents_id_seq OWNED BY public.transfer_documents.id;


--
-- TOC entry 298 (class 1259 OID 18922)
-- Name: type_rabot; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.type_rabot (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.type_rabot OWNER TO postgres;

--
-- TOC entry 299 (class 1259 OID 18930)
-- Name: type_rabot_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.type_rabot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.type_rabot_id_seq OWNER TO postgres;

--
-- TOC entry 5688 (class 0 OID 0)
-- Dependencies: 299
-- Name: type_rabot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.type_rabot_id_seq OWNED BY public.type_rabot.id;


--
-- TOC entry 300 (class 1259 OID 18931)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    login character varying(100) NOT NULL,
    password_hash character varying(255),
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 301 (class 1259 OID 18940)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5689 (class 0 OID 0)
-- Dependencies: 301
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 302 (class 1259 OID 18941)
-- Name: vidy_rabot; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vidy_rabot (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.vidy_rabot OWNER TO postgres;

--
-- TOC entry 303 (class 1259 OID 18951)
-- Name: vidy_rabot_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vidy_rabot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vidy_rabot_id_seq OWNER TO postgres;

--
-- TOC entry 5690 (class 0 OID 0)
-- Dependencies: 303
-- Name: vidy_rabot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vidy_rabot_id_seq OWNED BY public.vidy_rabot.id;


--
-- TOC entry 304 (class 1259 OID 18952)
-- Name: work_types_price; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_types_price (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    cost numeric(10,2) DEFAULT 0.00,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.work_types_price OWNER TO postgres;

--
-- TOC entry 305 (class 1259 OID 18961)
-- Name: work_types_price_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_types_price_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_types_price_id_seq OWNER TO postgres;

--
-- TOC entry 5691 (class 0 OID 0)
-- Dependencies: 305
-- Name: work_types_price_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_types_price_id_seq OWNED BY public.work_types_price.id;


--
-- TOC entry 306 (class 1259 OID 18962)
-- Name: works; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.works (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    replacement_group character varying(255),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    type_rabot_id integer,
    replacement_group_id integer
);


ALTER TABLE public.works OWNER TO postgres;

--
-- TOC entry 307 (class 1259 OID 18970)
-- Name: works_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.works_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.works_id_seq OWNER TO postgres;

--
-- TOC entry 5692 (class 0 OID 0)
-- Dependencies: 307
-- Name: works_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.works_id_seq OWNED BY public.works.id;


--
-- TOC entry 308 (class 1259 OID 18971)
-- Name: zaphasti; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zaphasti (
    id integer NOT NULL,
    article character varying(100),
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    manufacturer character varying(255),
    unit character varying(50) DEFAULT 'шт'::character varying,
    price_group character varying(100),
    replacement_group character varying(100),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    proizvoditel_id integer,
    ed_izmereniya_id integer,
    gruppa_tsen_id integer,
    gryppa_zamehenia_id integer
);


ALTER TABLE public.zaphasti OWNER TO postgres;

--
-- TOC entry 309 (class 1259 OID 18981)
-- Name: zaphasti_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zaphasti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zaphasti_id_seq OWNER TO postgres;

--
-- TOC entry 5693 (class 0 OID 0)
-- Dependencies: 309
-- Name: zaphasti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zaphasti_id_seq OWNED BY public.zaphasti.id;


--
-- TOC entry 5096 (class 2604 OID 18982)
-- Name: accident_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_events ALTER COLUMN id SET DEFAULT nextval('public.accident_events_id_seq'::regclass);


--
-- TOC entry 5098 (class 2604 OID 18983)
-- Name: accident_invoices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_invoices ALTER COLUMN id SET DEFAULT nextval('public.accident_invoices_id_seq'::regclass);


--
-- TOC entry 5101 (class 2604 OID 18984)
-- Name: accident_payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_payments ALTER COLUMN id SET DEFAULT nextval('public.accident_payments_id_seq'::regclass);


--
-- TOC entry 5104 (class 2604 OID 18985)
-- Name: accident_statuses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_statuses ALTER COLUMN id SET DEFAULT nextval('public.accident_statuses_id_seq'::regclass);


--
-- TOC entry 5105 (class 2604 OID 18986)
-- Name: accidents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accidents ALTER COLUMN id SET DEFAULT nextval('public.accidents_id_seq'::regclass);


--
-- TOC entry 5113 (class 2604 OID 18987)
-- Name: autoservices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autoservices ALTER COLUMN id SET DEFAULT nextval('public.autoservices_id_seq'::regclass);


--
-- TOC entry 5114 (class 2604 OID 18988)
-- Name: autostrahovanie id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autostrahovanie ALTER COLUMN id SET DEFAULT nextval('public.autostrahovanie_id_seq'::regclass);


--
-- TOC entry 5118 (class 2604 OID 18989)
-- Name: car_brands id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_brands ALTER COLUMN id SET DEFAULT nextval('public.car_brands_id_seq'::regclass);


--
-- TOC entry 5119 (class 2604 OID 18990)
-- Name: car_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models ALTER COLUMN id SET DEFAULT nextval('public.car_models_id_seq'::regclass);


--
-- TOC entry 5120 (class 2604 OID 18991)
-- Name: car_repairs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_repairs ALTER COLUMN id SET DEFAULT nextval('public.car_repairs_id_seq'::regclass);


--
-- TOC entry 5123 (class 2604 OID 18992)
-- Name: cars id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars ALTER COLUMN id SET DEFAULT nextval('public.cars_id_seq'::regclass);


--
-- TOC entry 5125 (class 2604 OID 18993)
-- Name: counterparties id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counterparties ALTER COLUMN id SET DEFAULT nextval('public.counterparties_id_seq'::regclass);


--
-- TOC entry 5127 (class 2604 OID 18994)
-- Name: counterparty_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counterparty_types ALTER COLUMN id SET DEFAULT nextval('public.counterparty_types_id_seq'::regclass);


--
-- TOC entry 5131 (class 2604 OID 18995)
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- TOC entry 5133 (class 2604 OID 18996)
-- Name: doc_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doc_types ALTER COLUMN id SET DEFAULT nextval('public.doc_types_id_seq'::regclass);


--
-- TOC entry 5134 (class 2604 OID 18997)
-- Name: ed_izmereniya id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ed_izmereniya ALTER COLUMN id SET DEFAULT nextval('public.ed_izmereniya_id_seq'::regclass);


--
-- TOC entry 5136 (class 2604 OID 18998)
-- Name: gruppa_tsen id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gruppa_tsen ALTER COLUMN id SET DEFAULT nextval('public.gruppa_tsen_id_seq'::regclass);


--
-- TOC entry 5140 (class 2604 OID 18999)
-- Name: gryppa_zamehenia id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gryppa_zamehenia ALTER COLUMN id SET DEFAULT nextval('public.gryppa_zamehenia_id_seq'::regclass);


--
-- TOC entry 5146 (class 2604 OID 19000)
-- Name: ispolnitel id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ispolnitel ALTER COLUMN id SET DEFAULT nextval('public.ispolnitel_id_seq'::regclass);


--
-- TOC entry 5148 (class 2604 OID 19001)
-- Name: kyzov_type id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyzov_type ALTER COLUMN id SET DEFAULT nextval('public.kyzov_type_id_seq'::regclass);


--
-- TOC entry 5149 (class 2604 OID 19002)
-- Name: mol id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mol ALTER COLUMN id SET DEFAULT nextval('public.mol_id_seq'::regclass);


--
-- TOC entry 5217 (class 2604 OID 20583)
-- Name: mol_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mol_users ALTER COLUMN id SET DEFAULT nextval('public.mol_users_id_seq'::regclass);


--
-- TOC entry 5151 (class 2604 OID 19003)
-- Name: move_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.move_items ALTER COLUMN id SET DEFAULT nextval('public.move_items_id_seq'::regclass);


--
-- TOC entry 5156 (class 2604 OID 19004)
-- Name: moves id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.moves ALTER COLUMN id SET DEFAULT nextval('public.moves_id_seq'::regclass);


--
-- TOC entry 5160 (class 2604 OID 19005)
-- Name: ostatok_zaphastei id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ostatok_zaphastei ALTER COLUMN id SET DEFAULT nextval('public.ostatok_zaphastei_id_seq'::regclass);


--
-- TOC entry 5164 (class 2604 OID 19006)
-- Name: payment_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_types ALTER COLUMN id SET DEFAULT nextval('public.payment_types_id_seq'::regclass);


--
-- TOC entry 5165 (class 2604 OID 19007)
-- Name: postavhik id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.postavhik ALTER COLUMN id SET DEFAULT nextval('public.postavhik_id_seq'::regclass);


--
-- TOC entry 5166 (class 2604 OID 19008)
-- Name: proizvoditel_zaphasti id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proizvoditel_zaphasti ALTER COLUMN id SET DEFAULT nextval('public.proizvoditel_zaphasti_id_seq'::regclass);


--
-- TOC entry 5168 (class 2604 OID 19009)
-- Name: receipt_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_items ALTER COLUMN id SET DEFAULT nextval('public.receipt_items_id_seq'::regclass);


--
-- TOC entry 5174 (class 2604 OID 19010)
-- Name: receipts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts ALTER COLUMN id SET DEFAULT nextval('public.receipts_id_seq'::regclass);


--
-- TOC entry 5178 (class 2604 OID 19011)
-- Name: repair_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_documents ALTER COLUMN id SET DEFAULT nextval('public.repair_documents_id_seq'::regclass);


--
-- TOC entry 5182 (class 2604 OID 19012)
-- Name: repair_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_items ALTER COLUMN id SET DEFAULT nextval('public.repair_items_id_seq'::regclass);


--
-- TOC entry 5183 (class 2604 OID 19013)
-- Name: repair_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_types ALTER COLUMN id SET DEFAULT nextval('public.repair_types_id_seq'::regclass);


--
-- TOC entry 5185 (class 2604 OID 19014)
-- Name: repair_works id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_works ALTER COLUMN id SET DEFAULT nextval('public.repair_works_id_seq'::regclass);


--
-- TOC entry 5187 (class 2604 OID 19015)
-- Name: repairs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repairs ALTER COLUMN id SET DEFAULT nextval('public.repairs_id_seq'::regclass);


--
-- TOC entry 5193 (class 2604 OID 19016)
-- Name: skladi id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skladi ALTER COLUMN id SET DEFAULT nextval('public.skladi_id_seq'::regclass);


--
-- TOC entry 5194 (class 2604 OID 19017)
-- Name: tehosmotr id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tehosmotr ALTER COLUMN id SET DEFAULT nextval('public.tehosmotr_id_seq'::regclass);


--
-- TOC entry 5197 (class 2604 OID 19018)
-- Name: toplivo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.toplivo ALTER COLUMN id SET DEFAULT nextval('public.toplivo_id_seq'::regclass);


--
-- TOC entry 5199 (class 2604 OID 19019)
-- Name: transfer_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_documents ALTER COLUMN id SET DEFAULT nextval('public.transfer_documents_id_seq'::regclass);


--
-- TOC entry 5202 (class 2604 OID 19020)
-- Name: type_rabot id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.type_rabot ALTER COLUMN id SET DEFAULT nextval('public.type_rabot_id_seq'::regclass);


--
-- TOC entry 5191 (class 2604 OID 19021)
-- Name: type_sklad id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.type_sklad ALTER COLUMN id SET DEFAULT nextval('public.sklad_id_seq'::regclass);


--
-- TOC entry 5204 (class 2604 OID 19022)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5206 (class 2604 OID 19023)
-- Name: vidy_rabot id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vidy_rabot ALTER COLUMN id SET DEFAULT nextval('public.vidy_rabot_id_seq'::regclass);


--
-- TOC entry 5209 (class 2604 OID 19024)
-- Name: work_types_price id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_types_price ALTER COLUMN id SET DEFAULT nextval('public.work_types_price_id_seq'::regclass);


--
-- TOC entry 5212 (class 2604 OID 19025)
-- Name: works id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.works ALTER COLUMN id SET DEFAULT nextval('public.works_id_seq'::regclass);


--
-- TOC entry 5214 (class 2604 OID 19026)
-- Name: zaphasti id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaphasti ALTER COLUMN id SET DEFAULT nextval('public.zaphasti_id_seq'::regclass);


--
-- TOC entry 5550 (class 0 OID 18531)
-- Dependencies: 219
-- Data for Name: accident_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accident_events (id, dtp_id, event_date, event_text) FROM stdin;
\.


--
-- TOC entry 5552 (class 0 OID 18539)
-- Dependencies: 221
-- Data for Name: accident_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accident_invoices (id, dtp_id, invoice_date, debtor, amount, description) FROM stdin;
\.


--
-- TOC entry 5554 (class 0 OID 18548)
-- Dependencies: 223
-- Data for Name: accident_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accident_payments (id, dtp_id, payment_date, payer, amount, payment_type, description, payment_type_id) FROM stdin;
\.


--
-- TOC entry 5556 (class 0 OID 18557)
-- Dependencies: 225
-- Data for Name: accident_statuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accident_statuses (id, name) FROM stdin;
\.


--
-- TOC entry 5558 (class 0 OID 18563)
-- Dependencies: 227
-- Data for Name: accidents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accidents (id, car_id, doc_number, doc_date, fact_date, detected_date, driver, culprit, damage_amount, account_number, paid_amount, description, actual_date, status_id, created_at) FROM stdin;
\.


--
-- TOC entry 5560 (class 0 OID 18578)
-- Dependencies: 229
-- Data for Name: autoservices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.autoservices (id, name) FROM stdin;
\.


--
-- TOC entry 5562 (class 0 OID 18584)
-- Dependencies: 231
-- Data for Name: autostrahovanie; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.autostrahovanie (id, doc_number, date, car_id, autoservice_id, insurance_current, insurance_next, sum, payment_type_id, description, fact_date, is_posted) FROM stdin;
\.


--
-- TOC entry 5564 (class 0 OID 18595)
-- Dependencies: 233
-- Data for Name: car_brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.car_brands (id, name, description) FROM stdin;
\.


--
-- TOC entry 5566 (class 0 OID 18603)
-- Dependencies: 235
-- Data for Name: car_models; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.car_models (id, name, brand_id, fuel_type, engine, start_date, end_date, description, body_id, kyzov_type_id, toplivo_id) FROM stdin;
\.


--
-- TOC entry 5568 (class 0 OID 18611)
-- Dependencies: 237
-- Data for Name: car_repairs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.car_repairs (id, car_id, repair_date, repair_type_id, mileage, total_cost, description) FROM stdin;
\.


--
-- TOC entry 5570 (class 0 OID 18620)
-- Dependencies: 239
-- Data for Name: cars; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cars (id, gos_number, model, body, engine, year, color, vin, pto_current, pto_next, insurance_current, insurance_next, description, created_at, model_id, toplivo_id) FROM stdin;
\.


--
-- TOC entry 5572 (class 0 OID 18629)
-- Dependencies: 241
-- Data for Name: counterparties; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.counterparties (id, name, short_name, description, created_at, counterparty_type_id) FROM stdin;
\.


--
-- TOC entry 5574 (class 0 OID 18638)
-- Dependencies: 243
-- Data for Name: counterparty_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.counterparty_types (id, name, description, is_pto, is_insurance, created_at) FROM stdin;
\.


--
-- TOC entry 5576 (class 0 OID 18649)
-- Dependencies: 245
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, type_id, name_full, name_short, discount_parts, discount_services, description, created_at) FROM stdin;
\.


--
-- TOC entry 5578 (class 0 OID 18659)
-- Dependencies: 247
-- Data for Name: doc_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doc_types (id, name, description) FROM stdin;
\.


--
-- TOC entry 5580 (class 0 OID 18667)
-- Dependencies: 249
-- Data for Name: ed_izmereniya; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ed_izmereniya (id, name, short_name, regex_pattern, error_text, created_at) FROM stdin;
\.


--
-- TOC entry 5582 (class 0 OID 18677)
-- Dependencies: 251
-- Data for Name: gruppa_tsen; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gruppa_tsen (id, name, markup_percent, rounding, description, created_at) FROM stdin;
\.


--
-- TOC entry 5584 (class 0 OID 18690)
-- Dependencies: 253
-- Data for Name: gryppa_zamehenia; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gryppa_zamehenia (id, name, control_km, normative_mileage, warning_1, warning_2, description, created_at) FROM stdin;
\.


--
-- TOC entry 5586 (class 0 OID 18703)
-- Dependencies: 255
-- Data for Name: ispolnitel; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ispolnitel (id, name, description, created_at) FROM stdin;
\.


--
-- TOC entry 5588 (class 0 OID 18712)
-- Dependencies: 257
-- Data for Name: kyzov_type; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kyzov_type (id, name, description) FROM stdin;
\.


--
-- TOC entry 5590 (class 0 OID 18720)
-- Dependencies: 259
-- Data for Name: mol; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mol (id, date_assigned, date_removed, description, created_at, user_id, warehouse_id) FROM stdin;
\.


--
-- TOC entry 5642 (class 0 OID 20580)
-- Dependencies: 311
-- Data for Name: mol_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mol_users (id, name, created_at) FROM stdin;
1	Администратор	2026-08-20 16:18:26.629607
2		2026-08-20 16:18:26.629607
\.


--
-- TOC entry 5592 (class 0 OID 18728)
-- Dependencies: 261
-- Data for Name: move_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.move_items (id, move_id, zaphasti_id, quantity, price, total_rub, description, currency, price_rub, income_document_id) FROM stdin;
\.


--
-- TOC entry 5594 (class 0 OID 18740)
-- Dependencies: 263
-- Data for Name: moves; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.moves (id, doc_number, date, warehouse_from_id, mol_from_id, warehouse_to_id, mol_to_id, description, sum_rub, fact_date, is_posted) FROM stdin;
\.


--
-- TOC entry 5596 (class 0 OID 18750)
-- Dependencies: 265
-- Data for Name: ostatok_zaphastei; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ostatok_zaphastei (id, article, code, name, manufacturer, price_group, description, warehouse_name, mol_name, quantity, unit, created_at) FROM stdin;
\.


--
-- TOC entry 5598 (class 0 OID 18764)
-- Dependencies: 267
-- Data for Name: payment_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_types (id, name) FROM stdin;
\.


--
-- TOC entry 5600 (class 0 OID 18770)
-- Dependencies: 269
-- Data for Name: postavhik; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.postavhik (id, type_id, name, short_name, description) FROM stdin;
\.


--
-- TOC entry 5602 (class 0 OID 18778)
-- Dependencies: 271
-- Data for Name: proizvoditel_zaphasti; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.proizvoditel_zaphasti (id, name, description, created_at) FROM stdin;
\.


--
-- TOC entry 5604 (class 0 OID 18787)
-- Dependencies: 273
-- Data for Name: receipt_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.receipt_items (id, receipt_id, zaphasti_id, quantity, price, currency, price_rub, total_rub, description) FROM stdin;
\.


--
-- TOC entry 5606 (class 0 OID 18803)
-- Dependencies: 275
-- Data for Name: receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.receipts (id, doc_number, date, warehouse_id, mol_id, supplier_id, sum_rub, fact_date, is_posted, description) FROM stdin;
\.


--
-- TOC entry 5608 (class 0 OID 18815)
-- Dependencies: 277
-- Data for Name: repair_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repair_documents (id, doc_number, doc_date, doc_type, repair_type, car_number, car_model, mileage, warehouse_service, description, total_sum, fact_date, status, created_at) FROM stdin;
\.


--
-- TOC entry 5610 (class 0 OID 18832)
-- Dependencies: 279
-- Data for Name: repair_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repair_items (id, repair_id, zaphast_id, article, code, name, quantity, unit, price, total, description, receipt_doc, receipt_id) FROM stdin;
\.


--
-- TOC entry 5612 (class 0 OID 18839)
-- Dependencies: 281
-- Data for Name: repair_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repair_types (id, name, description, created_at) FROM stdin;
\.


--
-- TOC entry 5614 (class 0 OID 18848)
-- Dependencies: 283
-- Data for Name: repair_works; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repair_works (id, repair_id, ispolnitel_id, work_id, price, description) FROM stdin;
\.


--
-- TOC entry 5616 (class 0 OID 18857)
-- Dependencies: 285
-- Data for Name: repairs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repairs (id, doc_number, doc_date, repair_type_id, car_id, mileage, doc_type_id, warehouse_id, mol_id, description, sum, doc_type, is_posted, fact_date) FROM stdin;
\.


--
-- TOC entry 5620 (class 0 OID 18876)
-- Dependencies: 289
-- Data for Name: skladi; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.skladi (id, type_sklad_id, name, description) FROM stdin;
\.


--
-- TOC entry 5622 (class 0 OID 18884)
-- Dependencies: 291
-- Data for Name: statuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.statuses (id, name) FROM stdin;
\.


--
-- TOC entry 5623 (class 0 OID 18889)
-- Dependencies: 292
-- Data for Name: tehosmotr; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tehosmotr (id, doc_number, date, to_date, next_to_date, car_id, autoservice, sum, payment_type, description, is_posted, fact_date, payment_type_id) FROM stdin;
\.


--
-- TOC entry 5625 (class 0 OID 18898)
-- Dependencies: 294
-- Data for Name: toplivo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.toplivo (id, name, account_tmc, account_expense, description, created_at) FROM stdin;
\.


--
-- TOC entry 5627 (class 0 OID 18907)
-- Dependencies: 296
-- Data for Name: transfer_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transfer_documents (id, doc_number, doc_date, warehouse_from, mol_from, warehouse_to, mol_to, description, total_sum, fact_date, status, created_at) FROM stdin;
\.


--
-- TOC entry 5629 (class 0 OID 18922)
-- Dependencies: 298
-- Data for Name: type_rabot; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.type_rabot (id, name, description, created_at) FROM stdin;
\.


--
-- TOC entry 5618 (class 0 OID 18867)
-- Dependencies: 287
-- Data for Name: type_sklad; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.type_sklad (id, name, description, created_at) FROM stdin;
\.


--
-- TOC entry 5631 (class 0 OID 18931)
-- Dependencies: 300
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, login, password_hash, name, description, created_at) FROM stdin;
1	admin	$2a$12$JHM4mOb855obYzqvtl9x4eE1BSoaHx3iEc.lFS0Zm5XD3aA6iknqK	Администратор	\N	2026-08-20 13:07:38.17232
2	кцукуцк	\N			2026-08-20 14:24:30.571529
\.


--
-- TOC entry 5633 (class 0 OID 18941)
-- Dependencies: 302
-- Data for Name: vidy_rabot; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vidy_rabot (id, name, price, description, created_at) FROM stdin;
\.


--
-- TOC entry 5635 (class 0 OID 18952)
-- Dependencies: 304
-- Data for Name: work_types_price; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_types_price (id, name, cost, description, created_at) FROM stdin;
\.


--
-- TOC entry 5637 (class 0 OID 18962)
-- Dependencies: 306
-- Data for Name: works; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.works (id, name, replacement_group, description, created_at, type_rabot_id, replacement_group_id) FROM stdin;
\.


--
-- TOC entry 5639 (class 0 OID 18971)
-- Dependencies: 308
-- Data for Name: zaphasti; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zaphasti (id, article, code, name, manufacturer, unit, price_group, replacement_group, description, created_at, proizvoditel_id, ed_izmereniya_id, gruppa_tsen_id, gryppa_zamehenia_id) FROM stdin;
\.


--
-- TOC entry 5694 (class 0 OID 0)
-- Dependencies: 220
-- Name: accident_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.accident_events_id_seq', 1, false);


--
-- TOC entry 5695 (class 0 OID 0)
-- Dependencies: 222
-- Name: accident_invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.accident_invoices_id_seq', 1, false);


--
-- TOC entry 5696 (class 0 OID 0)
-- Dependencies: 224
-- Name: accident_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.accident_payments_id_seq', 1, false);


--
-- TOC entry 5697 (class 0 OID 0)
-- Dependencies: 226
-- Name: accident_statuses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.accident_statuses_id_seq', 1, false);


--
-- TOC entry 5698 (class 0 OID 0)
-- Dependencies: 228
-- Name: accidents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.accidents_id_seq', 1, false);


--
-- TOC entry 5699 (class 0 OID 0)
-- Dependencies: 230
-- Name: autoservices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.autoservices_id_seq', 1, false);


--
-- TOC entry 5700 (class 0 OID 0)
-- Dependencies: 232
-- Name: autostrahovanie_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.autostrahovanie_id_seq', 1, false);


--
-- TOC entry 5701 (class 0 OID 0)
-- Dependencies: 234
-- Name: car_brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.car_brands_id_seq', 1, false);


--
-- TOC entry 5702 (class 0 OID 0)
-- Dependencies: 236
-- Name: car_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.car_models_id_seq', 1, false);


--
-- TOC entry 5703 (class 0 OID 0)
-- Dependencies: 238
-- Name: car_repairs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.car_repairs_id_seq', 1, false);


--
-- TOC entry 5704 (class 0 OID 0)
-- Dependencies: 240
-- Name: cars_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cars_id_seq', 1, false);


--
-- TOC entry 5705 (class 0 OID 0)
-- Dependencies: 242
-- Name: counterparties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.counterparties_id_seq', 1, false);


--
-- TOC entry 5706 (class 0 OID 0)
-- Dependencies: 244
-- Name: counterparty_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.counterparty_types_id_seq', 1, false);


--
-- TOC entry 5707 (class 0 OID 0)
-- Dependencies: 246
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 1, false);


--
-- TOC entry 5708 (class 0 OID 0)
-- Dependencies: 248
-- Name: doc_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.doc_types_id_seq', 1, false);


--
-- TOC entry 5709 (class 0 OID 0)
-- Dependencies: 250
-- Name: ed_izmereniya_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ed_izmereniya_id_seq', 1, false);


--
-- TOC entry 5710 (class 0 OID 0)
-- Dependencies: 252
-- Name: gruppa_tsen_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gruppa_tsen_id_seq', 1, false);


--
-- TOC entry 5711 (class 0 OID 0)
-- Dependencies: 254
-- Name: gryppa_zamehenia_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gryppa_zamehenia_id_seq', 1, false);


--
-- TOC entry 5712 (class 0 OID 0)
-- Dependencies: 256
-- Name: ispolnitel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ispolnitel_id_seq', 1, false);


--
-- TOC entry 5713 (class 0 OID 0)
-- Dependencies: 258
-- Name: kyzov_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.kyzov_type_id_seq', 1, false);


--
-- TOC entry 5714 (class 0 OID 0)
-- Dependencies: 260
-- Name: mol_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.mol_id_seq', 1, false);


--
-- TOC entry 5715 (class 0 OID 0)
-- Dependencies: 310
-- Name: mol_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.mol_users_id_seq', 1, false);


--
-- TOC entry 5716 (class 0 OID 0)
-- Dependencies: 262
-- Name: move_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.move_items_id_seq', 1, false);


--
-- TOC entry 5717 (class 0 OID 0)
-- Dependencies: 264
-- Name: moves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.moves_id_seq', 1, false);


--
-- TOC entry 5718 (class 0 OID 0)
-- Dependencies: 266
-- Name: ostatok_zaphastei_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ostatok_zaphastei_id_seq', 1, false);


--
-- TOC entry 5719 (class 0 OID 0)
-- Dependencies: 268
-- Name: payment_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_types_id_seq', 1, false);


--
-- TOC entry 5720 (class 0 OID 0)
-- Dependencies: 270
-- Name: postavhik_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.postavhik_id_seq', 1, false);


--
-- TOC entry 5721 (class 0 OID 0)
-- Dependencies: 272
-- Name: proizvoditel_zaphasti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.proizvoditel_zaphasti_id_seq', 1, false);


--
-- TOC entry 5722 (class 0 OID 0)
-- Dependencies: 274
-- Name: receipt_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.receipt_items_id_seq', 1, false);


--
-- TOC entry 5723 (class 0 OID 0)
-- Dependencies: 276
-- Name: receipts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.receipts_id_seq', 1, false);


--
-- TOC entry 5724 (class 0 OID 0)
-- Dependencies: 278
-- Name: repair_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repair_documents_id_seq', 1, false);


--
-- TOC entry 5725 (class 0 OID 0)
-- Dependencies: 280
-- Name: repair_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repair_items_id_seq', 1, false);


--
-- TOC entry 5726 (class 0 OID 0)
-- Dependencies: 282
-- Name: repair_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repair_types_id_seq', 1, false);


--
-- TOC entry 5727 (class 0 OID 0)
-- Dependencies: 284
-- Name: repair_works_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repair_works_id_seq', 1, false);


--
-- TOC entry 5728 (class 0 OID 0)
-- Dependencies: 286
-- Name: repairs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repairs_id_seq', 1, false);


--
-- TOC entry 5729 (class 0 OID 0)
-- Dependencies: 288
-- Name: sklad_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sklad_id_seq', 1, false);


--
-- TOC entry 5730 (class 0 OID 0)
-- Dependencies: 290
-- Name: skladi_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.skladi_id_seq', 1, false);


--
-- TOC entry 5731 (class 0 OID 0)
-- Dependencies: 293
-- Name: tehosmotr_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tehosmotr_id_seq', 1, false);


--
-- TOC entry 5732 (class 0 OID 0)
-- Dependencies: 295
-- Name: toplivo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.toplivo_id_seq', 1, false);


--
-- TOC entry 5733 (class 0 OID 0)
-- Dependencies: 297
-- Name: transfer_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transfer_documents_id_seq', 1, false);


--
-- TOC entry 5734 (class 0 OID 0)
-- Dependencies: 299
-- Name: type_rabot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.type_rabot_id_seq', 1, false);


--
-- TOC entry 5735 (class 0 OID 0)
-- Dependencies: 301
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- TOC entry 5736 (class 0 OID 0)
-- Dependencies: 303
-- Name: vidy_rabot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vidy_rabot_id_seq', 1, false);


--
-- TOC entry 5737 (class 0 OID 0)
-- Dependencies: 305
-- Name: work_types_price_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_types_price_id_seq', 1, false);


--
-- TOC entry 5738 (class 0 OID 0)
-- Dependencies: 307
-- Name: works_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.works_id_seq', 1, false);


--
-- TOC entry 5739 (class 0 OID 0)
-- Dependencies: 309
-- Name: zaphasti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zaphasti_id_seq', 1, false);


--
-- TOC entry 5220 (class 2606 OID 19028)
-- Name: accident_events accident_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_events
    ADD CONSTRAINT accident_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5222 (class 2606 OID 19030)
-- Name: accident_invoices accident_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_invoices
    ADD CONSTRAINT accident_invoices_pkey PRIMARY KEY (id);


--
-- TOC entry 5224 (class 2606 OID 19032)
-- Name: accident_payments accident_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_payments
    ADD CONSTRAINT accident_payments_pkey PRIMARY KEY (id);


--
-- TOC entry 5226 (class 2606 OID 19034)
-- Name: accident_statuses accident_statuses_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_statuses
    ADD CONSTRAINT accident_statuses_name_key UNIQUE (name);


--
-- TOC entry 5228 (class 2606 OID 19036)
-- Name: accident_statuses accident_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_statuses
    ADD CONSTRAINT accident_statuses_pkey PRIMARY KEY (id);


--
-- TOC entry 5230 (class 2606 OID 19038)
-- Name: accidents accidents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accidents
    ADD CONSTRAINT accidents_pkey PRIMARY KEY (id);


--
-- TOC entry 5234 (class 2606 OID 19040)
-- Name: autoservices autoservices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autoservices
    ADD CONSTRAINT autoservices_pkey PRIMARY KEY (id);


--
-- TOC entry 5236 (class 2606 OID 19042)
-- Name: autostrahovanie autostrahovanie_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autostrahovanie
    ADD CONSTRAINT autostrahovanie_pkey PRIMARY KEY (id);


--
-- TOC entry 5241 (class 2606 OID 19044)
-- Name: car_brands car_brands_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_brands
    ADD CONSTRAINT car_brands_name_key UNIQUE (name);


--
-- TOC entry 5243 (class 2606 OID 19046)
-- Name: car_brands car_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_brands
    ADD CONSTRAINT car_brands_pkey PRIMARY KEY (id);


--
-- TOC entry 5245 (class 2606 OID 19048)
-- Name: car_models car_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT car_models_pkey PRIMARY KEY (id);


--
-- TOC entry 5247 (class 2606 OID 19050)
-- Name: car_repairs car_repairs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_repairs
    ADD CONSTRAINT car_repairs_pkey PRIMARY KEY (id);


--
-- TOC entry 5249 (class 2606 OID 19052)
-- Name: cars cars_gos_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_gos_number_key UNIQUE (gos_number);


--
-- TOC entry 5251 (class 2606 OID 19054)
-- Name: cars cars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_pkey PRIMARY KEY (id);


--
-- TOC entry 5253 (class 2606 OID 19056)
-- Name: cars cars_vin_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_vin_key UNIQUE (vin);


--
-- TOC entry 5255 (class 2606 OID 19058)
-- Name: counterparties counterparties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counterparties
    ADD CONSTRAINT counterparties_pkey PRIMARY KEY (id);


--
-- TOC entry 5257 (class 2606 OID 19060)
-- Name: counterparty_types counterparty_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counterparty_types
    ADD CONSTRAINT counterparty_types_pkey PRIMARY KEY (id);


--
-- TOC entry 5259 (class 2606 OID 19062)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 5261 (class 2606 OID 19064)
-- Name: doc_types doc_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doc_types
    ADD CONSTRAINT doc_types_pkey PRIMARY KEY (id);


--
-- TOC entry 5263 (class 2606 OID 19066)
-- Name: ed_izmereniya ed_izmereniya_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ed_izmereniya
    ADD CONSTRAINT ed_izmereniya_pkey PRIMARY KEY (id);


--
-- TOC entry 5265 (class 2606 OID 19068)
-- Name: gruppa_tsen gruppa_tsen_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gruppa_tsen
    ADD CONSTRAINT gruppa_tsen_pkey PRIMARY KEY (id);


--
-- TOC entry 5267 (class 2606 OID 19070)
-- Name: gryppa_zamehenia gryppa_zamehenia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gryppa_zamehenia
    ADD CONSTRAINT gryppa_zamehenia_pkey PRIMARY KEY (id);


--
-- TOC entry 5269 (class 2606 OID 19072)
-- Name: ispolnitel ispolnitel_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ispolnitel
    ADD CONSTRAINT ispolnitel_pkey PRIMARY KEY (id);


--
-- TOC entry 5271 (class 2606 OID 19074)
-- Name: kyzov_type kyzov_type_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyzov_type
    ADD CONSTRAINT kyzov_type_name_key UNIQUE (name);


--
-- TOC entry 5273 (class 2606 OID 19076)
-- Name: kyzov_type kyzov_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyzov_type
    ADD CONSTRAINT kyzov_type_pkey PRIMARY KEY (id);


--
-- TOC entry 5275 (class 2606 OID 19078)
-- Name: mol mol_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mol
    ADD CONSTRAINT mol_pkey PRIMARY KEY (id);


--
-- TOC entry 5333 (class 2606 OID 20588)
-- Name: mol_users mol_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mol_users
    ADD CONSTRAINT mol_users_pkey PRIMARY KEY (id);


--
-- TOC entry 5277 (class 2606 OID 19080)
-- Name: move_items move_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.move_items
    ADD CONSTRAINT move_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5279 (class 2606 OID 19082)
-- Name: moves moves_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.moves
    ADD CONSTRAINT moves_pkey PRIMARY KEY (id);


--
-- TOC entry 5281 (class 2606 OID 19084)
-- Name: ostatok_zaphastei ostatok_zaphastei_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ostatok_zaphastei
    ADD CONSTRAINT ostatok_zaphastei_pkey PRIMARY KEY (id);


--
-- TOC entry 5283 (class 2606 OID 19086)
-- Name: payment_types payment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_types
    ADD CONSTRAINT payment_types_pkey PRIMARY KEY (id);


--
-- TOC entry 5285 (class 2606 OID 19088)
-- Name: postavhik postavhik_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.postavhik
    ADD CONSTRAINT postavhik_pkey PRIMARY KEY (id);


--
-- TOC entry 5287 (class 2606 OID 19090)
-- Name: proizvoditel_zaphasti proizvoditel_zaphasti_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proizvoditel_zaphasti
    ADD CONSTRAINT proizvoditel_zaphasti_pkey PRIMARY KEY (id);


--
-- TOC entry 5289 (class 2606 OID 19092)
-- Name: receipt_items receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT receipt_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5291 (class 2606 OID 19094)
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- TOC entry 5293 (class 2606 OID 19096)
-- Name: repair_documents repair_documents_doc_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_documents
    ADD CONSTRAINT repair_documents_doc_number_key UNIQUE (doc_number);


--
-- TOC entry 5295 (class 2606 OID 19098)
-- Name: repair_documents repair_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_documents
    ADD CONSTRAINT repair_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 5297 (class 2606 OID 19100)
-- Name: repair_items repair_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_items
    ADD CONSTRAINT repair_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5299 (class 2606 OID 19102)
-- Name: repair_types repair_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_types
    ADD CONSTRAINT repair_types_pkey PRIMARY KEY (id);


--
-- TOC entry 5301 (class 2606 OID 19104)
-- Name: repair_works repair_works_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_works
    ADD CONSTRAINT repair_works_pkey PRIMARY KEY (id);


--
-- TOC entry 5303 (class 2606 OID 19106)
-- Name: repairs repairs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repairs
    ADD CONSTRAINT repairs_pkey PRIMARY KEY (id);


--
-- TOC entry 5305 (class 2606 OID 19108)
-- Name: type_sklad sklad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.type_sklad
    ADD CONSTRAINT sklad_pkey PRIMARY KEY (id);


--
-- TOC entry 5307 (class 2606 OID 19110)
-- Name: skladi skladi_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skladi
    ADD CONSTRAINT skladi_pkey PRIMARY KEY (id);


--
-- TOC entry 5309 (class 2606 OID 19112)
-- Name: statuses statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statuses
    ADD CONSTRAINT statuses_pkey PRIMARY KEY (id);


--
-- TOC entry 5311 (class 2606 OID 19114)
-- Name: tehosmotr tehosmotr_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tehosmotr
    ADD CONSTRAINT tehosmotr_pkey PRIMARY KEY (id);


--
-- TOC entry 5313 (class 2606 OID 19116)
-- Name: toplivo toplivo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.toplivo
    ADD CONSTRAINT toplivo_pkey PRIMARY KEY (id);


--
-- TOC entry 5315 (class 2606 OID 19118)
-- Name: transfer_documents transfer_documents_doc_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_doc_number_key UNIQUE (doc_number);


--
-- TOC entry 5317 (class 2606 OID 19120)
-- Name: transfer_documents transfer_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 5319 (class 2606 OID 19122)
-- Name: type_rabot type_rabot_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.type_rabot
    ADD CONSTRAINT type_rabot_pkey PRIMARY KEY (id);


--
-- TOC entry 5321 (class 2606 OID 19124)
-- Name: users users_login_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_login_key UNIQUE (login);


--
-- TOC entry 5323 (class 2606 OID 19126)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5325 (class 2606 OID 19128)
-- Name: vidy_rabot vidy_rabot_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vidy_rabot
    ADD CONSTRAINT vidy_rabot_pkey PRIMARY KEY (id);


--
-- TOC entry 5327 (class 2606 OID 19130)
-- Name: work_types_price work_types_price_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_types_price
    ADD CONSTRAINT work_types_price_pkey PRIMARY KEY (id);


--
-- TOC entry 5329 (class 2606 OID 19132)
-- Name: works works_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.works
    ADD CONSTRAINT works_pkey PRIMARY KEY (id);


--
-- TOC entry 5331 (class 2606 OID 19134)
-- Name: zaphasti zaphasti_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaphasti
    ADD CONSTRAINT zaphasti_pkey PRIMARY KEY (id);


--
-- TOC entry 5231 (class 1259 OID 19135)
-- Name: idx_accidents_car_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accidents_car_id ON public.accidents USING btree (car_id);


--
-- TOC entry 5232 (class 1259 OID 19136)
-- Name: idx_accidents_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accidents_status_id ON public.accidents USING btree (status_id);


--
-- TOC entry 5237 (class 1259 OID 19137)
-- Name: idx_autostrahovanie_autoservice_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_autostrahovanie_autoservice_id ON public.autostrahovanie USING btree (autoservice_id);


--
-- TOC entry 5238 (class 1259 OID 19138)
-- Name: idx_autostrahovanie_car_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_autostrahovanie_car_id ON public.autostrahovanie USING btree (car_id);


--
-- TOC entry 5239 (class 1259 OID 19139)
-- Name: idx_autostrahovanie_payment_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_autostrahovanie_payment_type_id ON public.autostrahovanie USING btree (payment_type_id);


--
-- TOC entry 5399 (class 2620 OID 19140)
-- Name: receipts trg_receipt_fact_date; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_receipt_fact_date BEFORE INSERT OR UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.update_receipt_fact_date();


--
-- TOC entry 5396 (class 2620 OID 19141)
-- Name: accidents trg_set_actual_date; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_actual_date BEFORE INSERT OR UPDATE ON public.accidents FOR EACH ROW EXECUTE FUNCTION public.set_actual_date_always();


--
-- TOC entry 5402 (class 2620 OID 20590)
-- Name: users trg_sync_mol_users; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_mol_users AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_mol_user_trigger();


--
-- TOC entry 5393 (class 2620 OID 19142)
-- Name: accident_events trg_update_accident_description; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_accident_description AFTER INSERT OR UPDATE ON public.accident_events FOR EACH ROW EXECUTE FUNCTION public.update_accident_description();


--
-- TOC entry 5394 (class 2620 OID 19143)
-- Name: accident_invoices trg_update_accident_invoice_sum; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_accident_invoice_sum AFTER INSERT OR DELETE OR UPDATE ON public.accident_invoices FOR EACH ROW EXECUTE FUNCTION public.update_accident_invoice_sum();


--
-- TOC entry 5395 (class 2620 OID 19144)
-- Name: accident_payments trg_update_accident_paid; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_accident_paid AFTER INSERT OR DELETE OR UPDATE ON public.accident_payments FOR EACH ROW EXECUTE FUNCTION public.update_accident_paid_amount();


--
-- TOC entry 5397 (class 2620 OID 19145)
-- Name: move_items trg_update_move_sum; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_move_sum AFTER INSERT OR DELETE OR UPDATE ON public.move_items FOR EACH ROW EXECUTE FUNCTION public.update_move_total_sum();


--
-- TOC entry 5398 (class 2620 OID 19146)
-- Name: receipt_items trg_update_receipt_sum; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_receipt_sum AFTER INSERT OR DELETE OR UPDATE ON public.receipt_items FOR EACH ROW EXECUTE FUNCTION public.update_receipt_total_sum();


--
-- TOC entry 5401 (class 2620 OID 19147)
-- Name: repair_works trg_update_repair_sum; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_repair_sum AFTER INSERT OR DELETE OR UPDATE ON public.repair_works FOR EACH ROW EXECUTE FUNCTION public.update_repair_total_sum();


--
-- TOC entry 5400 (class 2620 OID 19148)
-- Name: repair_items trigger_update_repair_sum; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_repair_sum AFTER INSERT OR DELETE OR UPDATE ON public.repair_items FOR EACH ROW EXECUTE FUNCTION public.update_repair_total();


--
-- TOC entry 5334 (class 2606 OID 19149)
-- Name: accident_events accident_events_dtp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_events
    ADD CONSTRAINT accident_events_dtp_id_fkey FOREIGN KEY (dtp_id) REFERENCES public.accidents(id) ON DELETE CASCADE;


--
-- TOC entry 5335 (class 2606 OID 19154)
-- Name: accident_invoices accident_invoices_dtp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_invoices
    ADD CONSTRAINT accident_invoices_dtp_id_fkey FOREIGN KEY (dtp_id) REFERENCES public.accidents(id) ON DELETE CASCADE;


--
-- TOC entry 5336 (class 2606 OID 19159)
-- Name: accident_payments accident_payments_dtp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_payments
    ADD CONSTRAINT accident_payments_dtp_id_fkey FOREIGN KEY (dtp_id) REFERENCES public.accidents(id) ON DELETE CASCADE;


--
-- TOC entry 5339 (class 2606 OID 19164)
-- Name: accidents accidents_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accidents
    ADD CONSTRAINT accidents_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;


--
-- TOC entry 5340 (class 2606 OID 19169)
-- Name: accidents accidents_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accidents
    ADD CONSTRAINT accidents_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.accident_statuses(id);


--
-- TOC entry 5341 (class 2606 OID 19174)
-- Name: autostrahovanie autostrahovanie_autoservice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autostrahovanie
    ADD CONSTRAINT autostrahovanie_autoservice_id_fkey FOREIGN KEY (autoservice_id) REFERENCES public.autoservices(id) ON DELETE SET NULL;


--
-- TOC entry 5342 (class 2606 OID 19179)
-- Name: autostrahovanie autostrahovanie_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autostrahovanie
    ADD CONSTRAINT autostrahovanie_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE SET NULL;


--
-- TOC entry 5343 (class 2606 OID 19184)
-- Name: autostrahovanie autostrahovanie_payment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.autostrahovanie
    ADD CONSTRAINT autostrahovanie_payment_type_id_fkey FOREIGN KEY (payment_type_id) REFERENCES public.payment_types(id) ON DELETE SET NULL;


--
-- TOC entry 5344 (class 2606 OID 19189)
-- Name: car_models car_models_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT car_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.car_brands(id) ON DELETE CASCADE;


--
-- TOC entry 5345 (class 2606 OID 19194)
-- Name: car_models car_models_toplivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT car_models_toplivo_id_fkey FOREIGN KEY (toplivo_id) REFERENCES public.toplivo(id);


--
-- TOC entry 5350 (class 2606 OID 19199)
-- Name: car_repairs car_repairs_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_repairs
    ADD CONSTRAINT car_repairs_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;


--
-- TOC entry 5351 (class 2606 OID 19204)
-- Name: cars cars_toplivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_toplivo_id_fkey FOREIGN KEY (toplivo_id) REFERENCES public.toplivo(id);


--
-- TOC entry 5353 (class 2606 OID 19209)
-- Name: counterparties counterparties_counterparty_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counterparties
    ADD CONSTRAINT counterparties_counterparty_type_id_fkey FOREIGN KEY (counterparty_type_id) REFERENCES public.counterparty_types(id);


--
-- TOC entry 5337 (class 2606 OID 19214)
-- Name: accident_payments fk_accident_payments_dtp; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_payments
    ADD CONSTRAINT fk_accident_payments_dtp FOREIGN KEY (dtp_id) REFERENCES public.accidents(id) ON DELETE CASCADE;


--
-- TOC entry 5338 (class 2606 OID 19219)
-- Name: accident_payments fk_accident_payments_payment_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accident_payments
    ADD CONSTRAINT fk_accident_payments_payment_type FOREIGN KEY (payment_type_id) REFERENCES public.payment_types(id) ON DELETE SET NULL;


--
-- TOC entry 5346 (class 2606 OID 19224)
-- Name: car_models fk_brand; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT fk_brand FOREIGN KEY (brand_id) REFERENCES public.car_brands(id);


--
-- TOC entry 5347 (class 2606 OID 19229)
-- Name: car_models fk_car_models_body; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT fk_car_models_body FOREIGN KEY (body_id) REFERENCES public.kyzov_type(id) ON UPDATE CASCADE;


--
-- TOC entry 5348 (class 2606 OID 19234)
-- Name: car_models fk_car_models_brand; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT fk_car_models_brand FOREIGN KEY (brand_id) REFERENCES public.car_brands(id) ON UPDATE CASCADE;


--
-- TOC entry 5352 (class 2606 OID 19239)
-- Name: cars fk_cars_model; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT fk_cars_model FOREIGN KEY (model_id) REFERENCES public.car_models(id) ON DELETE SET NULL;


--
-- TOC entry 5354 (class 2606 OID 19244)
-- Name: customers fk_customers_counterparty_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_customers_counterparty_type FOREIGN KEY (type_id) REFERENCES public.counterparty_types(id) ON DELETE SET NULL;


--
-- TOC entry 5349 (class 2606 OID 19249)
-- Name: car_models fk_kyzov; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT fk_kyzov FOREIGN KEY (kyzov_type_id) REFERENCES public.kyzov_type(id);


--
-- TOC entry 5364 (class 2606 OID 19254)
-- Name: receipt_items fk_receipt_items_zaphasti; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT fk_receipt_items_zaphasti FOREIGN KEY (zaphasti_id) REFERENCES public.zaphasti(id) ON DELETE CASCADE;


--
-- TOC entry 5367 (class 2606 OID 19259)
-- Name: receipts fk_receipts_mol; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT fk_receipts_mol FOREIGN KEY (mol_id) REFERENCES public.mol(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 5368 (class 2606 OID 19264)
-- Name: receipts fk_receipts_status; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT fk_receipts_status FOREIGN KEY (is_posted) REFERENCES public.statuses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5382 (class 2606 OID 19269)
-- Name: skladi fk_skladi_type_sklad; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skladi
    ADD CONSTRAINT fk_skladi_type_sklad FOREIGN KEY (type_sklad_id) REFERENCES public.type_sklad(id) ON DELETE SET NULL;


--
-- TOC entry 5384 (class 2606 OID 19274)
-- Name: tehosmotr fk_tehosmotr_car; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tehosmotr
    ADD CONSTRAINT fk_tehosmotr_car FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE SET NULL;


--
-- TOC entry 5387 (class 2606 OID 19279)
-- Name: works fk_works_replacement_group; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.works
    ADD CONSTRAINT fk_works_replacement_group FOREIGN KEY (replacement_group_id) REFERENCES public.gryppa_zamehenia(id) ON DELETE SET NULL;


--
-- TOC entry 5388 (class 2606 OID 19284)
-- Name: works fk_works_type_rabot; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.works
    ADD CONSTRAINT fk_works_type_rabot FOREIGN KEY (type_rabot_id) REFERENCES public.type_rabot(id) ON DELETE SET NULL;


--
-- TOC entry 5389 (class 2606 OID 19289)
-- Name: zaphasti fk_zaphasti_ed_izmereniya; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaphasti
    ADD CONSTRAINT fk_zaphasti_ed_izmereniya FOREIGN KEY (ed_izmereniya_id) REFERENCES public.ed_izmereniya(id) ON DELETE SET NULL;


--
-- TOC entry 5390 (class 2606 OID 19294)
-- Name: zaphasti fk_zaphasti_gruppa_tsen; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaphasti
    ADD CONSTRAINT fk_zaphasti_gruppa_tsen FOREIGN KEY (gruppa_tsen_id) REFERENCES public.gruppa_tsen(id) ON DELETE SET NULL;


--
-- TOC entry 5391 (class 2606 OID 19299)
-- Name: zaphasti fk_zaphasti_gryppa_zamehenia; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaphasti
    ADD CONSTRAINT fk_zaphasti_gryppa_zamehenia FOREIGN KEY (gryppa_zamehenia_id) REFERENCES public.gryppa_zamehenia(id) ON DELETE SET NULL;


--
-- TOC entry 5392 (class 2606 OID 19304)
-- Name: zaphasti fk_zaphasti_proizvoditel; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaphasti
    ADD CONSTRAINT fk_zaphasti_proizvoditel FOREIGN KEY (proizvoditel_id) REFERENCES public.proizvoditel_zaphasti(id) ON DELETE SET NULL;


--
-- TOC entry 5355 (class 2606 OID 19309)
-- Name: mol mol_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mol
    ADD CONSTRAINT mol_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5356 (class 2606 OID 19314)
-- Name: mol mol_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mol
    ADD CONSTRAINT mol_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.skladi(id);


--
-- TOC entry 5357 (class 2606 OID 19319)
-- Name: move_items move_items_income_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.move_items
    ADD CONSTRAINT move_items_income_document_id_fkey FOREIGN KEY (income_document_id) REFERENCES public.receipts(id) ON DELETE SET NULL;


--
-- TOC entry 5358 (class 2606 OID 19324)
-- Name: move_items move_items_move_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.move_items
    ADD CONSTRAINT move_items_move_id_fkey FOREIGN KEY (move_id) REFERENCES public.moves(id) ON DELETE CASCADE;


--
-- TOC entry 5359 (class 2606 OID 19329)
-- Name: move_items move_items_zaphasti_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.move_items
    ADD CONSTRAINT move_items_zaphasti_id_fkey FOREIGN KEY (zaphasti_id) REFERENCES public.zaphasti(id);


--
-- TOC entry 5360 (class 2606 OID 19334)
-- Name: moves moves_mol_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.moves
    ADD CONSTRAINT moves_mol_from_id_fkey FOREIGN KEY (mol_from_id) REFERENCES public.mol(id);


--
-- TOC entry 5361 (class 2606 OID 19339)
-- Name: moves moves_mol_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.moves
    ADD CONSTRAINT moves_mol_to_id_fkey FOREIGN KEY (mol_to_id) REFERENCES public.mol(id);


--
-- TOC entry 5362 (class 2606 OID 19344)
-- Name: moves moves_warehouse_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.moves
    ADD CONSTRAINT moves_warehouse_from_id_fkey FOREIGN KEY (warehouse_from_id) REFERENCES public.skladi(id);


--
-- TOC entry 5363 (class 2606 OID 19349)
-- Name: moves moves_warehouse_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.moves
    ADD CONSTRAINT moves_warehouse_to_id_fkey FOREIGN KEY (warehouse_to_id) REFERENCES public.skladi(id);


--
-- TOC entry 5365 (class 2606 OID 19354)
-- Name: receipt_items receipt_items_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT receipt_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE CASCADE;


--
-- TOC entry 5366 (class 2606 OID 19359)
-- Name: receipt_items receipt_items_zaphasti_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT receipt_items_zaphasti_id_fkey FOREIGN KEY (zaphasti_id) REFERENCES public.zaphasti(id);


--
-- TOC entry 5369 (class 2606 OID 19364)
-- Name: receipts receipts_mol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_mol_id_fkey FOREIGN KEY (mol_id) REFERENCES public.mol(id);


--
-- TOC entry 5370 (class 2606 OID 19369)
-- Name: receipts receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.postavhik(id);


--
-- TOC entry 5371 (class 2606 OID 19374)
-- Name: receipts receipts_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.skladi(id);


--
-- TOC entry 5372 (class 2606 OID 19379)
-- Name: repair_items repair_items_repair_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_items
    ADD CONSTRAINT repair_items_repair_id_fkey FOREIGN KEY (repair_id) REFERENCES public.repairs(id) ON DELETE CASCADE;


--
-- TOC entry 5373 (class 2606 OID 19384)
-- Name: repair_items repair_items_zaphast_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_items
    ADD CONSTRAINT repair_items_zaphast_id_fkey FOREIGN KEY (zaphast_id) REFERENCES public.zaphasti(id);


--
-- TOC entry 5374 (class 2606 OID 19389)
-- Name: repair_works repair_works_ispolnitel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_works
    ADD CONSTRAINT repair_works_ispolnitel_id_fkey FOREIGN KEY (ispolnitel_id) REFERENCES public.ispolnitel(id) ON DELETE SET NULL;


--
-- TOC entry 5375 (class 2606 OID 19394)
-- Name: repair_works repair_works_repair_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_works
    ADD CONSTRAINT repair_works_repair_id_fkey FOREIGN KEY (repair_id) REFERENCES public.repairs(id) ON DELETE CASCADE;


--
-- TOC entry 5376 (class 2606 OID 19399)
-- Name: repair_works repair_works_work_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_works
    ADD CONSTRAINT repair_works_work_id_fkey FOREIGN KEY (work_id) REFERENCES public.works(id) ON DELETE RESTRICT;


--
-- TOC entry 5377 (class 2606 OID 19404)
-- Name: repairs repairs_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repairs
    ADD CONSTRAINT repairs_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE SET NULL;


--
-- TOC entry 5378 (class 2606 OID 19409)
-- Name: repairs repairs_doc_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repairs
    ADD CONSTRAINT repairs_doc_type_fkey FOREIGN KEY (doc_type) REFERENCES public.doc_types(id);


--
-- TOC entry 5379 (class 2606 OID 19414)
-- Name: repairs repairs_mol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repairs
    ADD CONSTRAINT repairs_mol_id_fkey FOREIGN KEY (mol_id) REFERENCES public.mol(id) ON DELETE SET NULL;


--
-- TOC entry 5380 (class 2606 OID 19419)
-- Name: repairs repairs_repair_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repairs
    ADD CONSTRAINT repairs_repair_type_id_fkey FOREIGN KEY (repair_type_id) REFERENCES public.repair_types(id) ON DELETE SET NULL;


--
-- TOC entry 5381 (class 2606 OID 19424)
-- Name: repairs repairs_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repairs
    ADD CONSTRAINT repairs_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.skladi(id) ON DELETE SET NULL;


--
-- TOC entry 5383 (class 2606 OID 19429)
-- Name: skladi skladi_type_sklad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skladi
    ADD CONSTRAINT skladi_type_sklad_id_fkey FOREIGN KEY (type_sklad_id) REFERENCES public.type_sklad(id);


--
-- TOC entry 5385 (class 2606 OID 19434)
-- Name: tehosmotr tehosmotr_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tehosmotr
    ADD CONSTRAINT tehosmotr_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id);


--
-- TOC entry 5386 (class 2606 OID 19439)
-- Name: tehosmotr tehosmotr_payment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tehosmotr
    ADD CONSTRAINT tehosmotr_payment_type_id_fkey FOREIGN KEY (payment_type_id) REFERENCES public.payment_types(id);


-- Completed on 2026-08-20 16:25:22

--
-- PostgreSQL database dump complete
--

\unrestrict 0MJhCSCCCioUOJhxPNKkCJ5vlW9lgScwVDEk58rO3DCCP1wRKRUw60nAfP49uXW

